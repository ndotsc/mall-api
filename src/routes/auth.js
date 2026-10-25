import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authRequired, comparePassword, hashPassword, signToken } from "../middleware/auth.js";
import prisma from "../prisma.js";
import { ok, fail } from '../utils/response.js'
import { validateBody } from '../middleware/validate.js'
import { AppError } from '../utils/AppError.js'
import { registerSchema, loginSchema } from '../validators/schemas.js'

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