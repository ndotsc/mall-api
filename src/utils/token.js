import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../prisma.js'
import { blacklistHas } from './blacklist.js'
import { AppError } from './AppError.js'

const SECRET = process.env.JWT_SECRET
// 可通过环境变量调整：access 默认 15 分钟，refresh 默认 7 天
const ACCESS_TTL_MIN = Number(process.env.JWT_ACCESS_TTL_MIN ?? 15)
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 7)

// 短期访问令牌：只带业务字段 + jti + 家族 familyId（注销时据此定位 refresh）
export function signAccessToken({ userId, role, familyId }) {
  return jwt.sign(
    { type: 'access', jti: crypto.randomUUID(), userId, role, familyId },
    SECRET,
    { expiresIn: `${ACCESS_TTL_MIN}m` },
  )
}

// 签发「访问 + 刷新」一对令牌。
// refresh 令牌：长期（默认 7 天），其 jti 同时作为 RefreshToken 表主键入库，
// 支持「轮换」（用旧 refresh 换新版时旧记录标记 revoked + replacedBy）与「整族吊销」（logout）。
export async function issueTokenPair({ userId, role, familyId }) {
  const fid = familyId || crypto.randomUUID()
  const refreshJti = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400000)
  await prisma.refreshToken.create({
    data: { id: refreshJti, userId, familyId: fid, expiresAt },
  })
  const token = signAccessToken({ userId, role, familyId: fid })
  const refreshToken = jwt.sign(
    { type: 'refresh', jti: refreshJti, userId, role, familyId: fid },
    SECRET,
    { expiresIn: `${REFRESH_TTL_DAYS}d` },
  )
  return { token, refreshToken, familyId: fid, refreshJti }
}

// 校验访问令牌：签名 / 过期 / 类型 / 黑名单。
// 兼容升级前无 type 字段的旧令牌（按 access 处理），避免存量会话立即失效。
export async function verifyAccessToken(token) {
  let payload
  try {
    payload = jwt.verify(token, SECRET)
  } catch {
    throw new AppError('token 无效或已过期', 401, 401)
  }
  if (payload.type !== undefined && payload.type !== 'access') {
    throw new AppError('token 类型错误', 401, 401)
  }
  if (await blacklistHas(payload.jti)) {
    throw new AppError('登录已失效，请重新登录', 401, 401)
  }
  return payload
}

// 仅校验刷新令牌的签名 / 过期 / 类型，返回 payload（库内状态由调用方查表判断）
export function verifyRefreshToken(token) {
  let payload
  try {
    payload = jwt.verify(token, SECRET)
  } catch {
    throw new AppError('refresh token 无效或已过期', 401, 401)
  }
  if (payload.type !== 'refresh') {
    throw new AppError('token 类型错误', 401, 401)
  }
  return payload
}

// 吊销某个登录家族下的所有 refresh 令牌（注销 = 本次登录及其刷新链全部失效）
export async function revokeFamily(familyId) {
  if (!familyId) return
  await prisma.refreshToken.updateMany({
    where: { familyId, revoked: false },
    data: { revoked: true },
  })
}
