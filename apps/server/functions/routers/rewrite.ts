import { Hono } from 'hono'
import type { Variables } from '../middleware/external-tokens'
import type { AuthVariables } from '../middleware/auth'
import { authMiddleware } from '../middleware/auth'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseAdminClient } from '@/utils/db'

interface RewriteBindings extends DataBaseEnvBindings {
  DOCX_REWRITE_API_KEY: string
  DOCX_REWRITE_API_URL: string
  [key: string]: any
}

const rewrite = new Hono<{ Variables: Variables & AuthVariables, Bindings: RewriteBindings }>()

rewrite.use('*', authMiddleware)

// POST /rewrite_docx - Upload Document
rewrite.post('/rewrite_docx', async (c) => {
  try {
    const userId = c.get('userId')
    const username = c.get('username')

    const supabase = createSupabaseAdminClient(c.env)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('points_balance')
      .eq('user_id', userId)
      .single()

    if ((userProfile?.points_balance || 0) < 100) {
      return c.json(createErrorResponse('积分不足，最少需要 100 积分才能使用改写功能', 403), 403)
    }

    const formData = await c.req.parseBody()
    const file = formData.file
    const rewriteType = formData.rewrite_type
    const apiKey = c.env.DOCX_REWRITE_API_KEY
    const apiUrl = c.env.DOCX_REWRITE_API_URL

    if (!file || typeof file !== 'object' || !('name' in file)) {
      return c.json(createErrorResponse('Missing file or invalid file format', 400), 400)
    }

    if (!rewriteType) {
      return c.json(createErrorResponse('Missing rewrite_type', 400), 400)
    }

    if (!apiKey) {
      return c.json(createErrorResponse('Server configuration error: DOCX_REWRITE_API_KEY missing', 500), 500)
    }

    // Buffer the file content to ensure we have it all in memory
    const fileBuffer = await (file as unknown as Blob).arrayBuffer()
    const fileName = (file as any).name
    const fileType = (file as any).type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    // const fileBlob = new Blob([fileBuffer], { type: fileType })

    // Construct manual multipart body
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`
    const parts: (string | Uint8Array)[] = []

    // Helper to add field
    const addField = (name: string, value: string) => {
      parts.push(`--${boundary}\r\n`)
      parts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`)
      parts.push(`${value}\r\n`)
    }

    addField('api_key', apiKey)
    addField('rewrite_type', rewriteType as string)

    // Add file
    parts.push(`--${boundary}\r\n`)
    parts.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`)
    parts.push(`Content-Type: ${fileType}\r\n\r\n`)
    parts.push(new Uint8Array(fileBuffer))
    parts.push(`\r\n--${boundary}--\r\n`)

    // Calculate length
    let length = 0
    for (const part of parts) {
      length += typeof part === 'string' ? new TextEncoder().encode(part).length : part.byteLength
    }

    // Combine parts
    const bodyBuffer = new Uint8Array(length)
    let offset = 0
    for (const part of parts) {
      if (typeof part === 'string') {
        const encoded = new TextEncoder().encode(part)
        bodyBuffer.set(encoded, offset)
        offset += encoded.length
      }
      else {
        bodyBuffer.set(part, offset)
        offset += part.byteLength
      }
    }

    console.log(`Sending manual multipart request, size: ${length} bytes`)

    const response = await fetch(`${apiUrl}/api/rewrite_docx`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': length.toString(),
        'Connection': 'close',
        'User-Agent': 'PaperRewritingApp/1.0',
      },
      body: bodyBuffer,
    })

    console.log(response)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upstream API error:', response.status, errorText)
      return c.json(createErrorResponse(`Upstream API error: ${response.status} - ${errorText}`, 502), 502)
    }

    const responseText = await response.text()
    console.log('Upstream response body:', responseText)

    let result
    try {
      result = JSON.parse(responseText)
    }
    catch (e) {
      console.error('JSON parse error:', e)
      return c.json(createErrorResponse(`Invalid upstream response: ${e}`, 502), 502)
    }

    const responseData = {
      ...result,
      cost: 0,
      new_balance: 0,
    }

    // Deduct points based on word_count
    if (result && result.word_count) {
      const wordCount = Number(result.word_count)
      if (!Number.isNaN(wordCount) && wordCount > 0) {
        // Log to words_count table
        await supabase.from('words_count').insert({
          words_count: wordCount,
        })

        const POINTS_PER_1000_CHARS = 3
        const cost = Math.trunc((wordCount / 1000 * POINTS_PER_1000_CHARS) * 1000) / 1000
        responseData.cost = cost

        // Get profile id
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, points_balance')
          .eq('user_id', userId)
          .single()

        if (profile) {
          const newBalance = Math.trunc(((profile.points_balance || 0) - cost) * 1000) / 1000
          responseData.new_balance = newBalance

          // Update balance
          await supabase.from('profiles')
            .update({ points_balance: newBalance })
            .eq('id', profile.id)

          // Record transaction
          await supabase.from('points_transactions').insert({
            profile_id: profile.id,
            transaction_type: 'spend',
            amount: -cost,
            balance_after: newBalance,
            description: `文档改写 (${file.name}) - ${wordCount}字`,
            reference_id: result.order_id,
            is_successful: true,
          })

          console.log(`[rewrite] Deducted ${cost} points for user ${username}`)
        }
      }
    }

    return c.json(createSuccessResponse(responseData, '文档已上传，等待处理'))
  }
  catch (error) {
    console.error('Rewrite upload error:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

// POST /rewrite_state - Check Status
rewrite.post('/rewrite_state', async (c) => {
  try {
    const { order_id, file_name } = await c.req.json<{
      order_id?: string
      file_name?: string
    }>()

    const apiKey = c.env.DOCX_REWRITE_API_KEY
    const apiUrl = c.env.DOCX_REWRITE_API_URL

    if (!order_id) {
      return c.json(createErrorResponse('Missing order_id', 400), 400)
    }

    if (!apiKey) {
      return c.json(createErrorResponse('Server configuration error: DOCX_REWRITE_API_KEY missing', 500), 500)
    }

    const upstreamBody: Record<string, string> = {
      api_key: apiKey,
      order_id,
    }

    if (file_name) {
      upstreamBody.file_name = file_name
    }

    const response = await fetch(`${apiUrl}/api/rewrite_state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upstream API error (state):', response.status, errorText)
      return c.json(createErrorResponse(`Upstream API error: ${response.status}`, 502), 502)
    }

    const result = await response.json()
    return c.json(createSuccessResponse(result))
  }
  catch (error) {
    console.error('Rewrite state error:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

// POST /rewrite_paragraph - Rewrite Paragraph
rewrite.post('/rewrite_paragraph', async (c) => {
  try {
    const { text, type } = await c.req.json<{
      text: string
      type?: number
    }>()

    const apiKey = c.env.DOCX_REWRITE_API_KEY
    const apiUrl = c.env.DOCX_REWRITE_API_URL

    if (!text) {
      return c.json(createErrorResponse('Missing text', 400), 400)
    }

    if (!apiKey) {
      return c.json(createErrorResponse('Server configuration error: DOCX_REWRITE_API_KEY missing', 500), 500)
    }

    const userId = c.get('userId')
    const username = c.get('username')

    const supabase = createSupabaseAdminClient(c.env)

    // Check balance
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, points_balance')
      .eq('user_id', userId)
      .single()

    // Calculate estimated cost (3 points per 1000 chars)
    const POINTS_PER_1000_CHARS = 3
    const charCount = text.length
    const cost = Math.max(0.01, Math.trunc((charCount / 1000 * POINTS_PER_1000_CHARS) * 1000) / 1000)

    if ((userProfile?.points_balance || 0) < cost) {
      return c.json(createErrorResponse(`积分不足，需要 ${cost} 积分`, 403), 403)
    }

    const upstreamBody = {
      api_key: apiKey,
      text,
      type: type ?? 0, // Default to 0 (lower repetition rate) if not provided
    }

    const response = await fetch(`${apiUrl}/api/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upstream API error (rewrite paragraph):', response.status, errorText)
      return c.json(createErrorResponse(`Upstream API error: ${response.status}`, 502), 502)
    }

    const result = await response.json()

    // Deduct points after successful rewrite
    let newBalance = userProfile?.points_balance || 0
    if (userProfile) {
      newBalance = Math.trunc(((userProfile.points_balance || 0) - cost) * 1000) / 1000

      // Update balance
      await supabase.from('profiles')
        .update({ points_balance: newBalance })
        .eq('id', userProfile.id)

      // Record transaction
      await supabase.from('points_transactions').insert({
        profile_id: userProfile.id,
        transaction_type: 'spend',
        amount: -cost,
        balance_after: newBalance,
        description: `全文改写 (${type === 1 ? '降AI' : '降重'}) - ${charCount}字`,
        // reference_id: result.order_id, // Paragraph rewrite might not return order_id, check result
        is_successful: true,
      })

      // Log to words_count table
      await supabase.from('words_count').insert({
        words_count: charCount,
      })

      console.log(`[rewrite_paragraph] Deducted ${cost} points for user ${username}`)
    }

    return c.json(createSuccessResponse({
      ...result,
      cost,
      new_balance: newBalance,
    }))
  }
  catch (error) {
    console.error('Rewrite paragraph error:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

export default rewrite
