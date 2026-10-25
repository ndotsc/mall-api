import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { AppError } from '../utils/AppError.js'

const SECRET = process.env.JWT_SECRET
const SALT_ROUNDS = 10

export async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash)
}

export function signToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function authRequired(req, res, next) {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
        return next(new AppError('未登录或登录已过期', 401, 401))
    }
    try {
        const payload = jwt.verify(token, SECRET)
        req.user = { userId: payload.userId, role: payload.role }
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