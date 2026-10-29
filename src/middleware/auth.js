import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { AppError } from '../utils/AppError.js'
import { blacklistHas } from '../utils/blacklist.js'

const SECRET = process.env.JWT_SECRET
const SALT_ROUNDS = 10

export async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash)
}

// 签发 JWT：除业务字段外附上唯一 jti（用于注销时拉黑）与 exp（过期时间）
export function signToken(payload) {
    return jwt.sign({ jti: crypto.randomUUID(), ...payload }, SECRET, { expiresIn: '7d' })
}

export async function authRequired(req, res, next) {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
        return next(new AppError('未登录或登录已过期', 401, 401))
    }
    try {
        const payload = jwt.verify(token, SECRET)
        // 注销后该 jti 会被拉黑，立即失效
        if (await blacklistHas(payload.jti)) {
            return next(new AppError('登录已失效，请重新登录', 401, 401))
        }
        // 把 jti / exp 透传给后续逻辑（logout 时要用 jti 拉黑）
        req.user = { userId: payload.userId, role: payload.role, jti: payload.jti, exp: payload.exp }
        next()
    } catch {
        return next(new AppError('token 无效', 401, 401))
    }
}

export function adminRequired(req, res, next) {
    if (req.user?.role !== 2) {
        return next(new AppError('需要管理员权限', 403, 403))
    }
    next()
}