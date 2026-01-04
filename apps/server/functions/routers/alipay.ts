import { Hono } from 'hono'
import { buildPagePayForm, verify } from '../../utils/alipay'

const alipay = new Hono()

alipay.post('/pay', async (c) => {
  try {
    const { out_trade_no, total_amount, subject } = await c.req.json()

    if (!out_trade_no || !total_amount || !subject) {
      return c.json({ error: 'Missing required parameters' }, 400)
    }

    const env = c.env as any

    let privateKey = env.ALIPAY_PRIVATE_KEY
    let publicKey = env.ALIPAY_PUBLIC_KEY

    if (!privateKey || !publicKey) {
      try {
        const kv = await paper_rewriting_kv
        if (!privateKey)
          privateKey = await kv.get('ALIPAY_PRIVATE_KEY')
        if (!publicKey)
          publicKey = await kv.get('ALIPAY_PUBLIC_KEY')
        console.log('Attempted to fetch keys from KV. Found private:', !!privateKey, 'Found public:', !!publicKey)
      }
      catch (e: any) {
        console.warn('Failed to fetch Alipay keys from KV:', e)
      }
    }

    // Detailed validation
    const missingKeys = []
    if (!env.ALIPAY_APP_ID)
      missingKeys.push('ALIPAY_APP_ID')
    if (!privateKey)
      missingKeys.push('ALIPAY_PRIVATE_KEY')
    if (!publicKey)
      missingKeys.push('ALIPAY_PUBLIC_KEY')

    if (missingKeys.length > 0) {
      const msg = `Missing Alipay configuration: ${missingKeys.join(', ')}`
      console.error(msg)
      return c.json({ error: msg, missing: missingKeys }, 500)
    }

    const html = await buildPagePayForm(
      {
        appId: env.ALIPAY_APP_ID,
        privateKey,
        alipayPublicKey: publicKey,
        gateway: env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do', // Use New Sandbox by default
        notifyUrl: env.ALIPAY_NOTIFY_URL,
        returnUrl: env.ALIPAY_RETURN_URL,
      },
      {
        out_trade_no,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount,
        subject,
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
      console.error('Missing Alipay Public Key for verification')
      return c.text('fail')
    }

    const isValid = await verify(params, publicKey)

    if (isValid) {
      // TODO: Update order status in database
      // const tradeStatus = params.trade_status
      // if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') { ... }

      console.log('Alipay notify verified:', params)
      return c.text('success')
    }
    else {
      console.error('Alipay notify verification failed', params)
      return c.text('fail')
    }
  }
  catch (e) {
    console.error('Alipay notify error:', e)
    return c.text('fail')
  }
})

export default alipay
