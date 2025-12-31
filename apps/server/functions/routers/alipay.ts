import { Hono } from 'hono'
import { buildPagePayForm, verify } from '../../utils/alipay'

const app = new Hono()

app.post('/pay', async (c) => {
  try {
    const { out_trade_no, total_amount, subject } = await c.req.json()

    if (!out_trade_no || !total_amount || !subject) {
      return c.json({ error: 'Missing required parameters' }, 400)
    }

    const env = c.env as any
    // Basic validation of env vars
    if (!env.ALIPAY_APP_ID || !env.ALIPAY_PRIVATE_KEY || !env.ALIPAY_PUBLIC_KEY) {
      console.error('Missing Alipay configuration')
      return c.json({ error: 'Server configuration error' }, 500)
    }

    const html = await buildPagePayForm(
      {
        appId: env.ALIPAY_APP_ID,
        privateKey: env.ALIPAY_PRIVATE_KEY,
        alipayPublicKey: env.ALIPAY_PUBLIC_KEY,
        gateway: env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do', // Use New Sandbox by default
        notifyUrl: env.ALIPAY_NOTIFY_URL,
        returnUrl: env.ALIPAY_RETURN_URL,
      },
      {
        out_trade_no,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount,
        subject,
      }
    )

    return c.html(html)
  } catch (e: any) {
    console.error('Alipay Pay Error:', e)
    return c.json({ error: e.message }, 500)
  }
})

app.post('/notify', async (c) => {
  try {
    const body = await c.req.parseBody()
    const params = body as Record<string, string>
    const env = c.env as any

    const isValid = await verify(params, env.ALIPAY_PUBLIC_KEY)
    
    if (isValid) {
      // TODO: Update order status in database
      // const tradeStatus = params.trade_status
      // if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') { ... }
      
      console.log('Alipay notify verified:', params)
      return c.text('success')
    } else {
      console.error('Alipay notify verification failed', params)
      return c.text('fail')
    }
  } catch (e) {
    console.error('Alipay notify error:', e)
    return c.text('fail')
  }
})

export default app
