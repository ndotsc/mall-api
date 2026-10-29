import rateLimit from 'express-rate-limit'
import { AppError } from '../utils/AppError.js'
import { KvRateLimitStore } from '../utils/rateLimitStore.js'

const WINDOW = 15 * 60 * 1000 // 15 分钟

// 全局限流：除健康检查外，每 IP 15 分钟最多 200 次请求
// 登录接口另有更严格的限流（auth.js 里的 authLimiter，15 分钟 10 次）
// 存储：默认进程内计数；配了 REDIS_URL（且装了 ioredis）则自动走 Redis，多实例一致。
// 见 kvStore.js / README「生产化清单」。
export const globalLimiter = rateLimit({
  windowMs: WINDOW,
  max: 200,
  standardHeaders: true, // 返回 RateLimit-* 响应头
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
  handler: (req, res, next) =>
    next(new AppError('请求过于频繁，请稍后再试', 429, 429)),
  store: new KvRateLimitStore(WINDOW),
})
