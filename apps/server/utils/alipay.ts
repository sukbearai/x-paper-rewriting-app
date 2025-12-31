/**
 * Alipay Utility Functions for Edge Runtime (Web Crypto API)
 */

interface AlipayConfig {
  appId: string
  privateKey: string
  alipayPublicKey: string
  gateway: string
  notifyUrl?: string
  returnUrl?: string
}

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
 * Sort and serialize parameters for signing
 * Filter out empty values and 'sign' field
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
 * Sign parameters using RSA-SHA256
 */
export async function sign(params: Record<string, string>, privateKeyPem: string): Promise<string> {
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

  // According to Alipay docs, verify should sign the params string (excluding sign/sign_type)
  // and compare with the provided signature.
  // Wait, no, verify means we take the sign string, and verify it against the signature using public key.

  const content = buildSignString(params)
  const encoder = new TextEncoder()
  const data = encoder.encode(content)

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

  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signatureBuffer,
    data,
  )
}

/**
 * Generate date string: YYYY-MM-DD HH:mm:ss
 */
const pad = (n: number) => n.toString().padStart(2, '0')

export function getNowDate(): string {
  // Use UTC time and add 8 hours for Beijing Time
  const d = new Date()
  const len = d.getTime()
  const offset = d.getTimezoneOffset() * 60000 // local offset in ms
  const utcTime = len + offset
  const date = new Date(utcTime + 3600000 * 8)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * Build HTML Form for auto-submission
 */
export async function buildPagePayForm(
  config: AlipayConfig,
  bizContent: Record<string, any>,
): Promise<string> {
  const commonParams: Record<string, string> = {
    app_id: config.appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: getNowDate(),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  }

  if (config.notifyUrl)
    commonParams.notify_url = config.notifyUrl
  if (config.returnUrl)
    commonParams.return_url = config.returnUrl

  const signature = await sign(commonParams, config.privateKey)
  commonParams.sign = signature

  // Build HTML
  const inputs = Object.entries(commonParams)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${value.replace(/"/g, '&quot;')}" />`)
    .join('\n')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Alipay</title>
      </head>
      <body>
        <form id="alipaysubmit" name="alipaysubmit" action="${config.gateway}?charset=utf-8" method="POST">
          ${inputs}
          <input type="submit" value="Pay" style="display:none" >
        </form>
        <script>document.forms['alipaysubmit'].submit();</script>
      </body>
    </html>
  `
}
