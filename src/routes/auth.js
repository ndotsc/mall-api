import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authRequired, comparePassword, hashPassword } from "../middleware/auth.js";
import { issueTokenPair, revokeFamily, verifyRefreshToken } from "../utils/token.js";
import prisma from "../prisma.js";
import { ok, fail } from '../utils/response.js'
import { validateBody } from '../middleware/validate.js'
import { AppError } from '../utils/AppError.js'
import {
  registerSchema,
  loginSchema,
  wxLoginSchema,
  wxOauthSchema,
  refreshSchema,
} from '../validators/schemas.js'
import { code2Session, oauthAccessToken } from '../utils/wechat.js'
import { blacklistAdd } from '../utils/blacklist.js'

const router = Router()

// 登录 / 注册限流：同一 IP 15 分钟内最多 10 次，防爆破
// 测试环境（NODE_ENV=test，vitest 默认会设）跳过限流，否则套件内多账号注册/刷新请求会累计触发 429
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => fail(res, 429, '尝试次数过多，请 15 分钟后再试', 429),
})

router.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
    const { username, password, nickname } = req.body || {}
    if (await prisma.user.findUnique({ where: { username } })) {
        throw new AppError('用户名已存在', 400, 400)
    }
    const user = await prisma.user.create({
        data: { username, password: await hashPassword(password), role: 1, nickname: nickname || null },
    })
    const { token, refreshToken } = await issueTokenPair({ userId: user.id, role: user.role })
    ok(res, { token, refreshToken, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } })
})

router.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
    const { username, password } = req.body || {}
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.password || !(await comparePassword(password, user.password))) {
        throw new AppError('用户名或密码错误', 401, 401)
    }
    const { token, refreshToken } = await issueTokenPair({ userId: user.id, role: user.role })
    ok(res, { token, refreshToken, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } })
})

// 微信类登录通用：按 openid 落地用户并签发令牌对（首次自动建号，密码存随机哈希占位，绝不存明文）
async function loginByOpenid(openid, unionid) {
  let user = await prisma.user.findUnique({ where: { openid } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: `wx_${openid}`,
        password: await hashPassword(`${openid}_${Date.now()}`),
        role: 1,
        openid,
        unionid: unionid || null,
      },
    })
  }
  const { token, refreshToken } = await issueTokenPair({ userId: user.id, role: user.role })
  return { token, refreshToken, user }
}

// 微信登录：小程序 / App 微信。前端 uni.login({ provider: 'weixin' }) 拿到 code 传过来，
// 后端用 code 换 openid，首次登录自动建号，最后签发令牌对
router.post('/wx-login', authLimiter, validateBody(wxLoginSchema), async (req, res) => {
  const { code } = req.validated
  const { openid, unionid } = await code2Session(code)
  const { token, refreshToken, user } = await loginByOpenid(openid, unionid)
  ok(res, {
    token,
    refreshToken,
    user: { id: user.id, nickname: user.nickname, role: user.role, avatar: user.avatar },
  })
})

// 公众号网页授权登录（H5 在微信内打开的「微信一键登录」）。前端先构造授权链接把用户重定向到微信，
// 微信带着 code 跳回前端回调页，前端再把 code 传过来；后端用 code 换 openid，落地用户并签发令牌对。
// scope 用 snsapi_base（静默拿 openid，无需用户点「同意」）。
router.post('/wx-oauth', authLimiter, validateBody(wxOauthSchema), async (req, res) => {
  const { code } = req.validated
  const { openid, unionid } = await oauthAccessToken(code)
  const { token, refreshToken, user } = await loginByOpenid(openid, unionid)
  ok(res, {
    token,
    refreshToken,
    user: { id: user.id, nickname: user.nickname, role: user.role, avatar: user.avatar },
  })
})

// 刷新令牌：用长期 refresh token 换新的「访问 + 刷新」对（access 过期后前端静默调用）。
// 采用「轮换」：旧 refresh 用一次即作废（replacedBy 指向新 jti）；若旧 refresh 被二次使用，
// 判定为复用攻击，整族吊销强制下线。
router.post('/refresh', authLimiter, validateBody(refreshSchema), async (req, res) => {
  const { refreshToken } = req.validated
  const payload = verifyRefreshToken(refreshToken)
  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } })
  if (!record || record.revoked) {
    throw new AppError('refresh token 已失效，请重新登录', 401, 401)
  }
  if (record.replacedBy) {
    // 复用检测：该 refresh 已被轮换过，疑似令牌泄露 → 整族吊销
    await revokeFamily(record.familyId)
    throw new AppError('检测到 refresh token 复用，已强制下线，请重新登录', 401, 401)
  }
  if (record.expiresAt < new Date()) {
    throw new AppError('refresh token 已过期，请重新登录', 401, 401)
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) {
    throw new AppError('用户不存在或已被删除', 401, 401)
  }
  const { token, refreshToken: newRefresh, refreshJti } = await issueTokenPair({
    userId: user.id,
    role: user.role,
    familyId: record.familyId, // 沿用同一家族，logout 才能整族吊销
  })
  await prisma.refreshToken.update({
    where: { id: payload.jti },
    data: { revoked: true, replacedBy: refreshJti },
  })
  ok(res, { token, refreshToken: newRefresh })
})

router.get('/me', authRequired, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, username: true, nickname: true, role: true, avatar: true, createdAt: true },
    })
    if (!user) {
        throw new AppError('用户不存在或已被删除', 401, 401)
    }
    ok(res, user)
})

// 注销登录：把当前 access 的 jti 拉黑（立即失效），并吊销本次登录家族的全部 refresh 令牌。
// 前端应在收到成功后清掉本地 token / refreshToken（见前端 auth store 的 logout）。
router.post('/logout', authRequired, async (req, res) => {
    blacklistAdd(req.user.jti, req.user.exp)
    await revokeFamily(req.user.familyId) // 整族吊销，本次登录及其刷新链全部失效
    ok(res, { success: true })
})

export default router
