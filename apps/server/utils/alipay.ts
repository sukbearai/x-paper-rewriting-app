/**
 * Alipay SDK for Edge Runtime (Web Crypto API)
 */

export interface AlipayConfig {
  appId: string
  privateKey: string
  alipayPublicKey: string
  gateway?: string
  notifyUrl?: string
  returnUrl?: string
}

export class AlipaySdk {
  private config: Required<AlipayConfig>

  constructor(config: AlipayConfig) {
    this.config = {
      gateway: 'https://openapi.alipay.com/gateway.do',
      notifyUrl: '',
      returnUrl: '',
      ...config,
    }
  }

  /**
   * Page Pay (Desktop Web)
   * Returns HTML form to auto-submit
   */
  async pagePay(bizContent: Record<string, any>): Promise<string> {
    const params = await this.buildRequestParams('alipay.trade.page.pay', bizContent)

    // Build HTML Form
    const inputs = Object.entries(params)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value.replace(/"/g, '&quot;')}" />`)
      .join('\n')

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Alipay</title>
        </head>
        <body>
          <form id="alipaysubmit" name="alipaysubmit" action="${this.config.gateway}?charset=utf-8" method="POST">
            ${inputs}
            <input type="submit" value="Pay" style="display:none" >
          </form>
          <script>document.forms['alipaysubmit'].submit();</script>
        </body>
      </html>
    `
  }

  /**
   * Query Order Status
   */
  async query(outTradeNo: string): Promise<any> {
    const bizContent = {
      out_trade_no: outTradeNo,
    }

    const params = await this.buildRequestParams('alipay.trade.query', bizContent)

    // Send Request
    const url = `${this.config.gateway}?charset=utf-8`
    const body = new URLSearchParams(params).toString()

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body,
    })

    if (!res.ok) {
      throw new Error(`Alipay API Error: ${res.status} ${res.statusText}`)
    }

    const json = await res.json() as any
    // Response key is strictly "alipay_trade_query_response"
    const response = json.alipay_trade_query_response
    // const sign = json.sign

    // TODO: Verify response signature if strictly required, but usually for query it is fine
    // provided we trust the https connection to alipay gateway.

    return response
  }

  /**
   * Verify Notify Signature
   */
  async verifySignature(params: Record<string, string>): Promise<boolean> {
    return verify(params, this.config.alipayPublicKey)
  }

  // ================= Private Helpers =================

  private async buildRequestParams(method: string, bizContent: Record<string, any>): Promise<Record<string, string>> {
    const commonParams: Record<string, string> = {
      app_id: this.config.appId,
      method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: getNowDate(),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    }

    if (this.config.notifyUrl)
      commonParams.notify_url = this.config.notifyUrl
    if (this.config.notifyUrl)
      commonParams.notify_url = this.config.notifyUrl
    if (this.config.returnUrl)
      commonParams.return_url = this.config.returnUrl

    console.log('Alipay Request Params:', JSON.stringify(commonParams, null, 2))

    const signature = await sign(commonParams, this.config.privateKey)
    commonParams.sign = signature

    return commonParams
  }
}

// ================= Utils (Keep Edge Compatible) =================

/**
 * Remove PEM header/footer and spaces/newlines
 */
function normalizeKey(key: string): string {
  return key
    .replace(/-----BEGIN.*?-----/, '')
    .replace(/-----END.*?-----/, '')
    .replace(/\s+/g, '')
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Sort and serialize parameters for signing payment requests
 * Filter out empty values and 'sign' field
 * Keep 'sign_type' for signing
 */
function buildSignString(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  const list: string[] = []

  for (const key of sortedKeys) {
    const value = params[key]
    if (key !== 'sign' && value !== undefined && value !== '') {
      list.push(`${key}=${value}`)
    }
  }

  return list.join('&')
}

/**
 * Sort and serialize parameters for verifying Alipay notifications
 * Filter out empty values, 'sign' AND 'sign_type' fields
 */
function buildVerifyString(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  const list: string[] = []

  for (const key of sortedKeys) {
    const value = params[key]
    if (key !== 'sign' && key !== 'sign_type' && value !== undefined && value !== '') {
      list.push(`${key}=${value}`)
    }
  }

  return list.join('&')
}

/**
 * Sign parameters using RSA-SHA256
 */
async function sign(params: Record<string, string>, privateKeyPem: string): Promise<string> {
  const content = buildSignString(params)
  const encoder = new TextEncoder()
  const data = encoder.encode(content)

  const binaryKey = base64ToArrayBuffer(normalizeKey(privateKeyPem))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    data,
  )

  return arrayBufferToBase64(signature)
}

/**
 * Verify signature using RSA-SHA256
 */
export async function verify(params: Record<string, string>, publicKeyPem: string): Promise<boolean> {
  const sign = params.sign
  if (!sign)
    return false

  const content = buildVerifyString(params) // Use verify-specific function
  const encoder = new TextEncoder()
  const data = encoder.encode(content)

  try {
    const signatureBuffer = base64ToArrayBuffer(sign)
    const binaryKey = base64ToArrayBuffer(normalizeKey(publicKeyPem))

    const key = await crypto.subtle.importKey(
      'spki', // Alipay public key is usually X.509 SubjectPublicKeyInfo (SPKI)
      binaryKey,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify'],
    )

    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signatureBuffer,
      data,
    )
  }
  catch (e) {
    console.error('Signature verification failed:', e)
    return false
  }
}

/**
 * Generate date string: YYYY-MM-DD HH:mm:ss
 */
const pad = (n: number) => n.toString().padStart(2, '0')

function getNowDate(): string {
  // Use UTC time and add 8 hours for Beijing Time
  const d = new Date()
  const len = d.getTime()
  const offset = d.getTimezoneOffset() * 60000 // local offset in ms
  const utcTime = len + offset
  const date = new Date(utcTime + 3600000 * 8)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
