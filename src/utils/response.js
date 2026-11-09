// ★ 全项目只有这个文件允许出现 res.json ★
// 其他地方一律调用 ok() / fail()，保证响应格式统一
// （2.1 验收标准：全局搜 res.json 只允许出现在本文件）
import { absolutize, publicOrigin } from './assetUrl.js'

export function ok(res, data = null, message = 'ok') {
  // 统一在响应出口把 `/uploads/xxx` 补成完整 URL：前端跨域部署时不必再靠 vite proxy。
  // res.req 是 Express 挂在响应上的请求引用；拿不到时（如单测里的假 res）保持原样。
  const payload = absolutize(data, publicOrigin(res.req))
  return res.status(200).json({ code: 0, message, data: payload })
}

export function fail(res, status = 500, message = '服务器错误', code = status) {
  return res.status(status).json({ code, message, data: null })
}
