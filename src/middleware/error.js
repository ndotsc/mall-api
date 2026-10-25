import { fail } from '../utils/response.js'
import { AppError } from '../utils/AppError.js'

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

  console.error('[error]', req.method, req.originalUrl, '=>', message)

  // 复用统一响应，res.json 仍只在 response.js 出现
  fail(res, status, message, code)
}
