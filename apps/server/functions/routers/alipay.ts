import { Hono } from 'hono'
import { buildPagePayForm, verify } from '../../utils/alipay'
import { authMiddleware } from '../middleware/auth'
import type { AuthVariables } from '../middleware/auth'
import { createErrorResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseAdminClient, createSupabaseClient } from '@/utils/db'

const alipay = new Hono<{ Bindings: DataBaseEnvBindings, Variables: AuthVariables }>()

function generateOutTradeNo(): string {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14) // YYYYMMDDHHmmss
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `PAY${timestamp}${random}`
}

alipay.post('/pay', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const { total_amount, subject, return_url } = await c.req.json()

    // Normalize amount
    const amount = Number(total_amount)
    if (!amount || Number.isNaN(amount) || amount < 1 || !Number.isInteger(amount)) {
      return c.json(createErrorResponse('充值金额必须为整数且至少为 1 元', 400), 400)
    }

    const env = c.env as any
    const supabase = createSupabaseAdminClient(c.env)

    // 1. Get user profile and rate
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, rate, email')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      return c.json(createErrorResponse('用户不存在', 404), 404)
    }

    // 2. Calculate points
    const rate = Number(profile.rate ?? 1)
    const points = Number((amount * rate).toFixed(3))

    // 3. Create Order
    const out_trade_no = generateOutTradeNo()

    // Check for keys - reused logic
    let privateKey = env.ALIPAY_PRIVATE_KEY
    let publicKey = env.ALIPAY_PUBLIC_KEY

    if (!privateKey || !publicKey) {
      try {
        const kv = await paper_rewriting_kv
        if (!privateKey)
          privateKey = await kv.get('ALIPAY_PRIVATE_KEY')
        if (!publicKey)
          publicKey = await kv.get('ALIPAY_PUBLIC_KEY')
      }
      catch (e) {
        console.warn('Failed to fetch Alipay keys from KV:', e)
      }
    }

    if (!env.ALIPAY_APP_ID || !privateKey || !publicKey) {
      return c.json(createErrorResponse('支付配置缺失', 500), 500)
    }

    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        out_trade_no,
        profile_id: profile.id,
        amount,
        points_amount: points,
        rate,
        status: 'pending',
        metadata: { subject },
      })

    if (orderError) {
      console.error('Failed to create order:', orderError)
      return c.json(createErrorResponse('创建订单失败', 500), 500)
    }

    // 4. Build Payment Form
    const html = await buildPagePayForm(
      {
        appId: env.ALIPAY_APP_ID,
        privateKey,
        alipayPublicKey: publicKey,
        gateway: env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
        notifyUrl: env.ALIPAY_NOTIFY_URL,
        returnUrl: return_url || env.ALIPAY_RETURN_URL,
      },
      {
        out_trade_no,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount: amount.toFixed(2),
        subject: subject || '积分充值',
      },
    )

    return c.html(html)
  }
  catch (e: any) {
    console.error('Alipay Pay Error:', e)
    return c.json({ error: e.message }, 500)
  }
})

alipay.post('/notify', async (c) => {
  try {
    const body = await c.req.parseBody()
    const params = body as Record<string, string>
    const env = c.env as any

    let publicKey = env.ALIPAY_PUBLIC_KEY
    if (!publicKey) {
      const kv = await paper_rewriting_kv
      publicKey = await kv.get('ALIPAY_PUBLIC_KEY')
    }

    if (!publicKey) {
      console.error('Missing Alipay Public Key')
      return c.text('fail')
    }

    const isValid = await verify(params, publicKey)

    if (!isValid) {
      console.error('Alipay verify failed')
      return c.text('fail')
    }

    const { out_trade_no, trade_status, total_amount } = params

    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'TRADE_FINISHED') {
      return c.text('success') // Just ignore other statuses
    }

    const supabase = createSupabaseAdminClient(c.env)

    // 1. Get Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('out_trade_no', out_trade_no)
      .single()

    if (orderError || !order) {
      console.error('Order not found:', out_trade_no)
      return c.text('fail') // Retry
    }

    // 2. Idempotency Check
    if (order.status === 'paid') {
      return c.text('success')
    }

    // 3. Amount Check
    if (Number(order.amount) !== Number(total_amount)) {
      console.error('Amount mismatch:', order.amount, total_amount)
      return c.text('fail')
    }

    // 4. Update Order & Profile (Transaction-like)
    // Update order status first to prevent race conditions (simple optimistic locking)
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString(),
        metadata: params,
      })
      .eq('id', order.id)
      .eq('status', 'pending') // Optimistic lock

    if (updateOrderError) {
      console.error('Failed to update order status:', updateOrderError)
      return c.text('fail')
    }

    // Add Points to Profile
    // We fetch current balance first or rely on RPC. Since we don't have decrement RPC shown,
    // we'll fetch and update.
    const { data: profile } = await supabase.from('profiles').select('points_balance').eq('id', order.profile_id).single()
    const currentBalance = profile?.points_balance || 0
    const newBalance = Number(currentBalance) + Number(order.points_amount)

    await supabase.from('profiles')
      .update({ points_balance: newBalance })
      .eq('id', order.profile_id)

    // Record Transaction
    await supabase.from('points_transactions').insert({
      profile_id: order.profile_id,
      transaction_type: 'recharge',
      amount: order.points_amount,
      balance_after: newBalance,
      description: `支付宝充值 (订单号: ${out_trade_no})`,
      reference_id: out_trade_no,
      is_successful: true,
    })

    console.log(`Order ${out_trade_no} processed, added ${order.points_amount} points.`)
    return c.text('success')
  }
  catch (e: any) {
    console.error('Alipay notify error:', e)
    return c.text('fail')
  }
})

export default alipay
