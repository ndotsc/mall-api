// ★ 全项目只有这个文件允许出现 res.json ★
// 其他地方一律调用 ok() / fail()，保证响应格式统一
// （2.1 验收标准：全局搜 res.json 只允许出现在本文件）

export function ok(res, data = null, message = 'ok') {
  return res.status(200).json({ code: 0, message, data })
}

export function fail(res, status = 500, message = '服务器错误', code = status) {
  return res.status(status).json({ code, message, data: null })
}
