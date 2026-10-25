import { AppError } from '../utils/AppError.js'

// 校验请求体：失败抛 400（带 zod 指出的具体字段原因）；
// 成功把规整后的数据挂到 req.validated，供路由按需取用。
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const message =
        result.error.issues
          .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
          .join('；') || '参数校验失败'
      next(new AppError(message, 400, 400))
      return
    }
    req.validated = result.data
    next()
  }
}
