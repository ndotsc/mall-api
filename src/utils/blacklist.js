import { kvSet, kvGet } from './kvStore.js'

// 已注销 token 的黑名单。
// 注销登录时把 token 的 jti 记进来，直到 token 原定的过期时间为止即自动失效。
//
// 存储后端：默认进程内 Map；若配置了 REDIS_URL 且装了 ioredis，则自动走 Redis，
// 多实例部署时各实例共享（否则重启清空、多实例互不可见）。详见 kvStore.js。
export async function blacklistAdd(jti, expSec) {
  if (!jti || !expSec) return
  const ttl = expSec * 1000 - Date.now()
  if (ttl <= 0) return // 已过期，无需记录
  await kvSet(`bl:${jti}`, '1', ttl)
}

export async function blacklistHas(jti) {
  if (!jti) return false
  return (await kvGet(`bl:${jti}`)) != null
}
