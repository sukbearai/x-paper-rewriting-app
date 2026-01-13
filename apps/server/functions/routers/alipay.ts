import { Hono } from 'hono'
import { AlipaySdk } from '../../utils/alipay'
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
          publicKey = await kv.get('ALIPAY_ASYNC_PUBLIC_KEY')
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
    const alipaySdk = new AlipaySdk({
      appId: env.ALIPAY_APP_ID,
      privateKey,
      alipayPublicKey: publicKey,
      gateway: env.ALIPAY_GATEWAY,
      notifyUrl: env.ALIPAY_NOTIFY_URL || 'https://rewriting.congrongtech.cn/alipay/notify',
      returnUrl: return_url || env.ALIPAY_RETURN_URL,
    })

    const html = await alipaySdk.pagePay({
      out_trade_no,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: amount.toFixed(2),
      subject: subject || '积分充值',
    })

    return c.html(html)
  }
  catch (e: any) {
    console.error('Alipay Pay Error:', e)
    return c.json({ error: e.message }, 500)
  }
})

// 代理为下级充值
alipay.post('/pay-for-downline', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const role = c.get('role')
    const { target_user_id, total_amount, subject, return_url } = await c.req.json()

    // 1. 验证代理身份
    const normalizedRole = typeof role === 'string' ? role.toLowerCase() : ''
    if (normalizedRole !== 'agent' && normalizedRole !== 'admin') {
      return c.json(createErrorResponse('仅代理和管理员可以为下级充值', 403), 403)
    }

    // 2. 验证充值金额
    const amount = Number(total_amount)
    if (!amount || Number.isNaN(amount) || amount < 1 || !Number.isInteger(amount)) {
      return c.json(createErrorResponse('充值金额必须为整数且至少为 1 元', 400), 400)
    }

    // 3. 验证目标用户ID
    if (!target_user_id || typeof target_user_id !== 'string') {
      return c.json(createErrorResponse('目标用户ID不能为空', 400), 400)
    }

    const env = c.env as any
    const supabase = createSupabaseAdminClient(c.env)

    // 4. 获取代理信息
    const { data: agentProfile, error: agentProfileError } = await supabase
      .from('profiles')
      .select('id, rate, email, username')
      .eq('user_id', userId)
      .single()

    if (agentProfileError || !agentProfile) {
      return c.json(createErrorResponse('代理用户不存在', 404), 404)
    }

    // 5. 获取目标下级用户信息
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('profiles')
      .select('id, rate, email, username, invited_by')
      .eq('user_id', target_user_id)
      .single()

    if (targetProfileError || !targetProfile) {
      return c.json(createErrorResponse('目标用户不存在', 404), 404)
    }

    // 6. 验证下级关系（管理员可以跳过）
    if (normalizedRole === 'agent' && targetProfile.invited_by !== agentProfile.id) {
      return c.json(createErrorResponse('目标用户不是您的下级，无权为其充值', 403), 403)
    }

    // 7. 计算积分（使用代理的费率，而非下级费率）
    // 这样代理可以通过费率差为下级提供优惠或赚取利润
    const agentRate = Number(agentProfile.rate ?? 1)
    const targetRate = Number(targetProfile.rate ?? 1)
    const points = Number((amount * agentRate).toFixed(3))

    // 8. 创建订单
    const out_trade_no = generateOutTradeNo()

    // 检查支付宝配置
    let privateKey = env.ALIPAY_PRIVATE_KEY
    let publicKey = env.ALIPAY_PUBLIC_KEY

    if (!privateKey || !publicKey) {
      try {
        const kv = await paper_rewriting_kv
        if (!privateKey)
          privateKey = await kv.get('ALIPAY_PRIVATE_KEY')
        if (!publicKey)
          publicKey = await kv.get('ALIPAY_ASYNC_PUBLIC_KEY')
      }
      catch (e) {
        console.warn('Failed to fetch Alipay keys from KV:', e)
      }
    }

    if (!env.ALIPAY_APP_ID || !privateKey || !publicKey) {
      return c.json(createErrorResponse('支付配置缺失', 500), 500)
    }

    // 9. 插入订单，记录代付信息
    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        out_trade_no,
        profile_id: targetProfile.id, // 受益人
        amount,
        points_amount: points,
        rate: agentRate, // 使用代理费率
        status: 'pending',
        metadata: {
          subject,
          payment_type: 'pay_for_downline', // 标记为代付订单
          payer_profile_id: agentProfile.id, // 付款人
          payer_user_id: userId,
          payer_username: agentProfile.username,
          payer_rate: agentRate, // 付款人费率
          beneficiary_profile_id: targetProfile.id, // 受益人
          beneficiary_user_id: target_user_id,
          beneficiary_username: targetProfile.username,
          beneficiary_rate: targetRate, // 受益人费率
          rate_profit: Number((agentRate - targetRate).toFixed(3)), // 费率差（利润）
        },
      })

    if (orderError) {
      console.error('Failed to create pay-for-downline order:', orderError)
      return c.json(createErrorResponse('创建订单失败', 500), 500)
    }

    // 10. 构建支付表单
    const alipaySdk = new AlipaySdk({
      appId: env.ALIPAY_APP_ID,
      privateKey,
      alipayPublicKey: publicKey,
      gateway: env.ALIPAY_GATEWAY,
      notifyUrl: env.ALIPAY_NOTIFY_URL || 'https://rewriting.congrongtech.cn/alipay/notify',
      returnUrl: return_url || 'https://www.ttdjai.com/proxy',
    })

    const html = await alipaySdk.pagePay({
      out_trade_no,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: amount.toFixed(2),
      subject: subject || `为 ${targetProfile.username || target_user_id} 充值积分`,
    })

    return c.html(html)
  }
  catch (e: any) {
    console.error('Alipay Pay-for-Downline Error:', e)
    return c.json({ error: e.message }, 500)
  }
})

alipay.post('/notify', async (c) => {
  try {
    const body = await c.req.parseBody()
    // console.log('Alipay Notify Params:', c.req)
    const params = body as Record<string, string>
    const env = c.env as any

    let publicKey = env.ALIPAY_ASYNC_PUBLIC_KEY || env.ALIPAY_PUBLIC_KEY
    if (!publicKey) {
      const kv = await paper_rewriting_kv
      publicKey = await kv.get('ALIPAY_ASYNC_PUBLIC_KEY') || await kv.get('ALIPAY_PUBLIC_KEY')
    }

    if (!publicKey) {
      console.error('Missing Alipay Public Key for verification')
      return c.text('fail')
    }

    const alipaySdk = new AlipaySdk({
      appId: env.ALIPAY_APP_ID, // Not really used for verify but required by constructor types? logic check needed
      privateKey: '', // Not needed for verify
      alipayPublicKey: publicKey,
    })

    const isValid = await alipaySdk.verifySignature(params)

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
        metadata: { ...order.metadata, ...params }, // 合并元数据，保留原有的 payment_type 等信息
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

    // 判断是否为代付订单
    const isPayForDownline = order.metadata?.payment_type === 'pay_for_downline'

    // 构建描述信息
    let description: string
    if (isPayForDownline) {
      const payerName = order.metadata?.payer_username || order.metadata?.payer_user_id || '代理'
      const beneficiaryName = order.metadata?.beneficiary_username || order.metadata?.beneficiary_user_id || '下级用户'
      description = `代理充值 - ${payerName} 为 ${beneficiaryName} 充值 (订单: ${out_trade_no})`
    }
    else {
      description = `支付宝充值 (订单号: ${out_trade_no})`
    }

    // Record Transaction
    await supabase.from('points_transactions').insert({
      profile_id: order.profile_id,
      transaction_type: 'recharge',
      amount: order.points_amount,
      balance_after: newBalance,
      description,
      reference_id: out_trade_no,
      is_successful: true,
      metadata: isPayForDownline
        ? {
            payment_type: 'pay_for_downline',
            payer_profile_id: order.metadata?.payer_profile_id,
            payer_user_id: order.metadata?.payer_user_id,
            payer_username: order.metadata?.payer_username,
            beneficiary_profile_id: order.metadata?.beneficiary_profile_id,
            beneficiary_user_id: order.metadata?.beneficiary_user_id,
            beneficiary_username: order.metadata?.beneficiary_username,
            payer_rate: order.metadata?.payer_rate,
            beneficiary_rate: order.metadata?.beneficiary_rate,
            rate_profit: order.metadata?.rate_profit,
          }
        : undefined,
    })

    console.log(`Order ${out_trade_no} processed, added ${order.points_amount} points to ${isPayForDownline ? 'beneficiary' : 'user'}.`)
    return c.text('success')
  }
  catch (e: any) {
    console.error('Alipay notify error: ', e)
    return c.text('fail')
  }
})

export default alipay
