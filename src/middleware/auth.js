import bcrypt from 'bcryptjs'
import { AppError } from '../utils/AppError.js'
import { verifyAccessToken } from '../utils/token.js'

const SALT_ROUNDS = 10

export async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash)
}

export async function authRequired(req, res, next) {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
        return next(new AppError('未登录或登录已过期', 401, 401))
    }
    try {
        // verifyAccessToken 同时校验签名 / 过期 / 黑名单（见 utils/token.js）
        const payload = await verifyAccessToken(token)
        // 把 jti / exp / familyId 透传给后续逻辑（logout 时要用 jti 拉黑、familyId 整族吊销）
        req.user = { userId: payload.userId, role: payload.role, jti: payload.jti, exp: payload.exp, familyId: payload.familyId }
        next()
    } catch (e) {
        next(e)
    }
}

export function adminRequired(req, res, next) {
    if (req.user?.role !== 2) {
        return next(new AppError('需要管理员权限', 403, 403))
    }
    next()
}