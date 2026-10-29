import { kvIncr, kvDel } from './kvStore.js'

// 适配 express-rate-limit v8 的自定义存储后端。
// 复用 kvStore 的「Redis / 内存」双实现，因此：
//   - 单实例：进程内计数（与历史一致）
//   - 多实例 + REDIS_URL：Redis 原子 INCR 计数，限流全局一致
//
// express-rate-limit 要求的 store 接口：increment / decrement / resetKey（decrement 可选）。
export class KvRateLimitStore {
  constructor(windowMs) {
    this.windowMs = windowMs
  }

  async increment(key) {
    const totalHits = await kvIncr(key, this.windowMs)
    return { totalHits, resetTime: new Date(Date.now() + this.windowMs) }
  }

  // 请求因校验失败被拒时 rate-limit 会调用 decrement；内存/Redis 都采用 TTL 自然过期，这里忽略。
  async decrement() {}

  async resetKey(key) {
    await kvDel(key)
  }
}
