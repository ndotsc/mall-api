import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authRequired, comparePassword, hashPassword, signToken } from "../middleware/auth.js";
import prisma from "../prisma.js";
import { ok, fail } from '../utils/response.js'
import { validateBody } from '../middleware/validate.js'
import { AppError } from '../utils/AppError.js'
import { registerSchema, loginSchema, wxLoginSchema, wxOauthSchema } from '../validators/schemas.js'
import { code2Session, oauthAccessToken } from '../utils/wechat.js'

const router = Router()

// 登录 / 注册限流：同一 IP 15 分钟内最多 10 次，防爆破
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
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
    const token = signToken({ userId: user.id, role: user.role })
    ok(res, { token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } })
})

router.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
    const { username, password } = req.body || {}
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.password || !(await comparePassword(password, user.password))) {
        throw new AppError('用户名或密码错误', 401, 401)
    }
    const token = signToken({ userId: user.id, role: user.role })
    ok(res, { token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } })
})

// 微信类登录通用：按 openid 落地用户并签发 JWT（首次自动建号，密码存随机哈希占位，绝不存明文）
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
  const token = signToken({ userId: user.id, role: user.role })
  return { token, user }
}

// 微信登录：小程序 / App 微信。前端 uni.login({ provider: 'weixin' }) 拿到 code 传过来，
// 后端用 code 换 openid，首次登录自动建号，最后签发 JWT
router.post('/wx-login', authLimiter, validateBody(wxLoginSchema), async (req, res) => {
  const { code } = req.validated
  const { openid, unionid } = await code2Session(code)
  const { token, user } = await loginByOpenid(openid, unionid)
  ok(res, {
    token,
    user: { id: user.id, nickname: user.nickname, role: user.role, avatar: user.avatar },
  })
})

// 公众号网页授权登录（H5 在微信内打开的「微信一键登录」）。前端先构造授权链接把用户重定向到微信，
// 微信带着 code 跳回前端回调页，前端再把 code 传过来；后端用 code 换 openid，落地用户并签发 JWT。
// scope 用 snsapi_base（静默拿 openid，无需用户点「同意」）。
router.post('/wx-oauth', authLimiter, validateBody(wxOauthSchema), async (req, res) => {
  const { code } = req.validated
  const { openid, unionid } = await oauthAccessToken(code)
  const { token, user } = await loginByOpenid(openid, unionid)
  ok(res, {
    token,
    user: { id: user.id, nickname: user.nickname, role: user.role, avatar: user.avatar },
  })
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

export default router