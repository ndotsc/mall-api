import { AppError } from './AppError.js'

// 小程序 / App（微信）登录用的应用凭证，从微信公众平台 / 开放平台获取，配在 .env
const APPID = process.env.WX_APPID
const SECRET = process.env.WX_SECRET

// 用 wx.login 拿到的临时 code 换取 openid / session_key
// 文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
// 注意：这是「小程序 / App 微信」的 jscode2session 流程；H5 在微信内打开要走「公众号网页授权」(sns/oauth2)，流程不同，需另接。
export async function code2Session(code) {
  if (!APPID || !SECRET) {
    throw new AppError('服务器未配置微信登录（缺少 WX_APPID / WX_SECRET）', 500, 500)
  }
  const url =
    `https://api.weixin.qq.com/sns/jscode2session` +
    `?appid=${encodeURIComponent(APPID)}` +
    `&secret=${encodeURIComponent(SECRET)}` +
    `&js_code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.errcode) {
    throw new AppError(`微信登录失败：${data.errmsg || data.errcode}`, 400, 400)
  }
  return data // { openid, session_key, unionid? }
}

// 公众号网页授权（H5 在微信内打开）用的应用凭证，缺省复用小程序凭证
const OA_APPID = process.env.WX_OA_APPID || process.env.WX_APPID
const OA_SECRET = process.env.WX_OA_SECRET || process.env.WX_SECRET

// 用公众号网页授权拿到的 code 换取 access_token + openid
// 文档：https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/Wechat_webpage_authorization.html
// 前端先构造授权链接把用户重定向到微信（scope 用 snsapi_base 静默拿 openid）：
//   https://open.weixin.qq.com/connect/oauth2/authorize?appid=OA_APPID
//     &redirect_uri=<encodeURIComponent(前端回调地址)>&response_type=code
//     &scope=snsapi_base&state=<随机防CSRF>&connect_redirect=1#wechat_redirect
// 微信带着 code 跳回 redirect_uri 后，前端把 code 传给本函数
export async function oauthAccessToken(code) {
  if (!OA_APPID || !OA_SECRET) {
    throw new AppError('服务器未配置公众号登录（缺少 WX_OA_APPID / WX_OA_SECRET，或未退回的 WX_APPID / WX_SECRET）', 500, 500)
  }
  const url =
    `https://api.weixin.qq.com/sns/oauth2/access_token` +
    `?appid=${encodeURIComponent(OA_APPID)}` +
    `&secret=${encodeURIComponent(OA_SECRET)}` +
    `&code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.errcode) {
    throw new AppError(`微信网页授权失败：${data.errmsg || data.errcode}`, 400, 400)
  }
  return data // { access_token, openid, unionid?, scope, expires_in }
}
