// 统一业务错误：携带 HTTP 状态码(status)与业务码(code)，
// 交给 errorHandler 统一输出，避免各路由散写 `e.status = 400` 这类赋值。
export class AppError extends Error {
  constructor(message, status = 400, code = status) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
  }
}
