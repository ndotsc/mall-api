// 已注销 token 的黑名单（内存版）
// 注销登录时把 token 的 jti 记进来，直到 token 原定的过期时间为止
//
// ⚠️ 局限：内存存储，服务重启即清空；且多实例部署时各实例不共享。
// 生产多实例请改用 Redis（SET jti 1 EX ttl），这里保留接口语义即可平滑替换。
const blacklist = new Map() // jti -> 过期时间戳(ms)

export function blacklistAdd(jti, exp) {
  if (!jti || !exp) return
  blacklist.set(jti, exp * 1000)
}

export function blacklistHas(jti) {
  if (!jti) return false
  const exp = blacklist.get(jti)
  if (exp === undefined) return false
  if (Date.now() > exp) {
    blacklist.delete(jti) // 已过期，顺手清理
    return false
  }
  return true
}
