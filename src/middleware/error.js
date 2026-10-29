import { fail } from '../utils/response.js'
import { AppError } from '../utils/AppError.js'
import { logger, redact } from '../utils/logger.js'
import { captureError } from '../utils/sentry.js'

// 404 兜底：放在所有路由之后（见 app.js）
// 自己造一个带 status/code 的错误，交给下面的 errorHandler 统一输出
export function notFound(req, res, next) {
  next(new AppError(`接口不存在: ${req.method} ${req.originalUrl}`, 404, 404))
}

// 错误中间件：必须是 4 个参数！Express 靠参数个数认出它
export function errorHandler(err, req, res, next) {
  const status = err.status || 500
  const code = err.code ?? status
  const message = err.message || '服务器内部错误'

  // 带上 req.id 方便在日志系统里串联同一次请求的其他记录
  // 出错时记脱敏后的请求体，便于排查「到底传了什么才报错」
  // 非生产环境额外附上堆栈
  const meta = {
    id: req.id,
    method: req.method,
    url: req.originalUrl,
    status,
    body: redact(req.body),
  }
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    meta.stack = err.stack
  }
  logger.error(message, meta)

  // 可选 APM：装了 @sentry/node 且配置了 SENTRY_DSN 时，把异常上报到 Sentry
  // （未装则 captureError 内部 no-op，不影响主流程）
  captureError(err, { reqId: req.id, method: req.method, url: req.originalUrl })

  // 复用统一响应，res.json 仍只在 response.js 出现
  fail(res, status, message, code)
}
