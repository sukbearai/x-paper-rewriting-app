import { Hono } from 'hono'
import type { Variables } from '../middleware/external-tokens'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseClient } from '@/utils/db'

const testRpc = new Hono<{ Bindings: DataBaseEnvBindings }>()

/**
 * POST /test-rpc
 *
 * 测试 PostgreSQL RPC 函数连通性
 *
 * 成功响应：
 * {
 *   "code": 0,
 *   "message": "RPC 调用成功",
 *   "data": {
 *     "rpcResult": "Hello world",
 *     "timestamp": "2024-01-01T00:00:00.000Z"
 *   },
 *   "timestamp": 1761540000000
 * }
 */
testRpc.post('/', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env)

    console.log('=== RPC 测试开始 ===')

    // 调用 RPC 函数
    const { data, error } = await supabase.rpc('hello_world')

    console.log('RPC 响应数据:', data)
    console.log('RPC 错误信息:', error)
    console.log('=== RPC 测试结束 ===')

    if (error) {
      return c.json(createErrorResponse(
        `RPC 调用失败: ${error.message}`,
        500,
        {
          errorDetails: error,
        },
      ), 500)
    }

    // 成功响应
    return c.json(createSuccessResponse(
      {
        rpcResult: data,
        timestamp: new Date().toISOString(),
      },
      'RPC 调用成功',
    ))
  }
  catch (err) {
    console.error('RPC 测试异常:', err)
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

/**
 * POST /test-rpc/kv
 *
 * 测试 KV 存储功能
 *
 * 成功响应：
 * {
 *   "code": 0,
 *   "message": "KV 测试成功",
 *   "data": {
 *     "key": "test-rpc:test_key",
 *     "value": "test_value",
 *     "timestamp": "2024-01-01T00:00:00.000Z"
 *   },
 *   "timestamp": 1761540000000
 * }
 */
testRpc.post('/kv', async (c) => {
  try {
    const kv = await paper_rewriting_kv
    const testKey = 'test-rpc:test_key'
    const testValue = 'test_value'

    await kv.put(testKey, testValue)
    const storedValue = await kv.get(testKey, { type: 'text' }) as string | null

    if (!storedValue) {
      return c.json(createErrorResponse('KV 读取失败', 500), 500)
    }

    // await kv.delete(testKey)

    return c.json(createSuccessResponse({
      key: testKey,
      value: storedValue,
      timestamp: new Date().toISOString(),
    }, 'KV 测试成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : 'KV 测试异常'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

testRpc.post('/kv-token', async (c) => {
  return c.json(createSuccessResponse({
    cheeyuanToken: (c.var as Variables).cheeyuanToken,
    reduceAiToken: (c.var as Variables).reduceAiToken,
  }, '获取成功'))
})

export default testRpc
