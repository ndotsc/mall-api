import { logger } from './logger.js'

// 可选 Redis 后端：只在 REDIS_URL 存在且 ioredis 可加载时启用；
// 否则退化为进程内 Map（与历史行为一致）。多实例部署时才需要配 Redis，
// 这样限流计数 / 注销黑名单才能在多台实例间共享，否则每台实例各自计数、黑名单互不可见。
//
// 注：ioredis 是「可选依赖」。未安装时本文件会动态 import 失败并自动回退内存版，
// 业务不受影响。需要多实例共享时再 `pnpm add ioredis`。
let redis = undefined // undefined=尚未初始化；null=不可用；object=已连上
const mem = new Map()

export async function getRedis() {
  if (redis !== undefined) return redis
  if (!process.env.REDIS_URL) {
    redis = null
    return null
  }
  try {
    const mod = await import('ioredis')
    const IORedis = mod.default || mod
    const client = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableOfflineQueue: true,
    })
    client.on('error', (e) => logger.warn('[kv] Redis 错误', { message: e.message }))
    await client.connect()
    redis = client
    logger.info('[kv] 已连接 Redis（限流 / 注销黑名单走 Redis）')
  } catch (e) {
    logger.warn('[kv] 连接 Redis 失败，退化为内存存储', { message: e.message })
    redis = null
  }
  return redis
}

export async function kvSet(key, value, ttlMs) {
  const r = await getRedis()
  if (r) {
    await r.set(key, String(value), 'PX', Math.max(1, ttlMs))
    return
  }
  mem.set(key, { v: String(value), exp: Date.now() + ttlMs })
}

export async function kvGet(key) {
  const r = await getRedis()
  if (r) {
    const v = await r.get(key)
    return v == null ? null : v
  }
  const e = mem.get(key)
  if (!e) return null
  if (e.exp < Date.now()) {
    mem.delete(key)
    return null
  }
  return e.v
}

export async function kvDel(key) {
  const r = await getRedis()
  if (r) {
    await r.del(key)
    return
  }
  mem.delete(key)
}

// 原子自增（限流用）。Redis 走 INCR + PEXPIRE；内存版用带过期的计数。
export async function kvIncr(key, ttlMs) {
  const r = await getRedis()
  if (r) {
    const total = await r.incr(key)
    if (total === 1) await r.pexpire(key, ttlMs)
    return total
  }
  const now = Date.now()
  const e = mem.get(key)
  const cur = e && e.exp > now ? e.c : 0
  const next = cur + 1
  mem.set(key, { c: next, exp: now + ttlMs })
  return next
}
