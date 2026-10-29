import rateLimit from 'express-rate-limit'
import { AppError } from '../utils/AppError.js'

// 全局限流：除健康检查外，每 IP 15 分钟最多 200 次请求
// 登录接口另有更严格的限流（auth.js 里的 authLimiter，15 分钟 10 次）
// 注意：进程内计数，多实例部署需换 Redis 等共享存储（见 README）
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true, // 返回 RateLimit-* 响应头
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
  handler: (req, res, next) =>
    next(new AppError('请求过于频繁，请稍后再试', 429, 429)),
})
