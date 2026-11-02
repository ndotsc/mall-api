import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired, adminRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { couponCreateSchema } from '../validators/schemas.js'
import { couponLabel } from '../utils/coupon.js'

const router = Router()

// 领券中心：列出当前可领取的券（在领取时间窗内），并标注是否已领 / 剩余量。
// GET /api/coupons
router.get('/', authRequired, async (req, res) => {
  const now = new Date()
  const coupons = await prisma.coupon.findMany({
    where: { validFrom: { lte: now }, validTo: { gte: now } },
    orderBy: { createdAt: 'desc' },
  })
  const ids = coupons.map((c) => c.id)
  // 批量聚合：每个券已被领取总数 + 当前用户已领的券
  const claimedAgg = ids.length
    ? await prisma.userCoupon.groupBy({ by: ['couponId'], where: { couponId: { in: ids } }, _count: true })
    : []
  const claimedMap = new Map(claimedAgg.map((r) => [r.couponId, r._count]))
  const myClaimed = ids.length
    ? await prisma.userCoupon.findMany({
        where: { userId: req.user.userId, couponId: { in: ids } },
        select: { couponId: true },
      })
    : []
  const mySet = new Set(myClaimed.map((r) => r.couponId))

  const list = coupons.map((c) => {
    const taken = claimedMap.get(c.id) || 0
    const remaining = c.total === -1 ? -1 : Math.max(0, c.total - taken)
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      threshold: c.threshold,
      value: c.value,
      maxDiscount: c.maxDiscount,
      validFrom: c.validFrom,
      validTo: c.validTo,
      label: couponLabel(c),
      remaining, // -1 表示不限量
      claimed: mySet.has(c.id),
    }
  })
  ok(res, { list })
})

// 管理员创建优惠券模板。
// POST /api/coupons  { name, type, threshold?, value, maxDiscount?, validFrom, validTo, total?, perUserLimit? }
router.post('/', authRequired, adminRequired, validateBody(couponCreateSchema), async (req, res) => {
  const coupon = await prisma.coupon.create({ data: { ...req.validated } })
  ok(res, coupon)
})

// 领取优惠券（幂等于领取：已在限领内直接返回已有记录）。
// POST /api/coupons/:id/claim
router.post('/:id/claim', authRequired, async (req, res) => {
  const couponId = Number(req.params.id)
  if (!Number.isInteger(couponId) || couponId <= 0) {
    throw new AppError('couponId 无效', 400, 400)
  }
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!coupon) throw new AppError('优惠券不存在', 404, 404)

  const now = new Date()
  if (now < coupon.validFrom) throw new AppError('优惠券尚未开始领取', 400, 400)
  if (now > coupon.validTo) throw new AppError('优惠券已结束领取', 400, 400)

  // 每人限领
  const myCount = await prisma.userCoupon.count({ where: { userId: req.user.userId, couponId } })
  if (myCount >= coupon.perUserLimit) {
    throw new AppError('已达领取上限', 400, 400)
  }
  // 总量限制（不限量 total=-1 跳过）
  if (coupon.total !== -1) {
    const taken = await prisma.userCoupon.count({ where: { couponId } })
    if (taken >= coupon.total) {
      throw new AppError('优惠券已抢光', 400, 400)
    }
  }

  const existing = await prisma.userCoupon.findFirst({
    where: { userId: req.user.userId, couponId, status: 'unused' },
  })
  if (existing) return ok(res, existing) // 幂等：返回未用的那张

  const created = await prisma.userCoupon.create({
    data: { userId: req.user.userId, couponId },
  })
  ok(res, created)
})

// 我的优惠券：按状态过滤（unused 未使用 / used 已使用 / expired 已过期）。
// 已过期 = 未使用且模板 validTo 已过（不在 DB 存过期态，展示时按时间算）。
// GET /api/coupons/mine?status=unused
router.get('/mine', authRequired, async (req, res) => {
  const status = (req.query.status || 'unused').toString()
  const now = new Date()
  const all = await prisma.userCoupon.findMany({
    where: { userId: req.user.userId },
    orderBy: { claimedAt: 'desc' },
    include: { coupon: true },
  })

  const mapped = all.map((uc) => {
    const effective = uc.status === 'used' ? 'used' : uc.coupon.validTo < now ? 'expired' : 'unused'
    return {
      id: uc.id,
      status: effective,
      claimedAt: uc.claimedAt,
      usedAt: uc.usedAt,
      orderId: uc.orderId,
      coupon: {
        id: uc.coupon.id,
        name: uc.coupon.name,
        type: uc.coupon.type,
        threshold: uc.coupon.threshold,
        value: uc.coupon.value,
        maxDiscount: uc.coupon.maxDiscount,
        validFrom: uc.coupon.validFrom,
        validTo: uc.coupon.validTo,
        label: couponLabel(uc.coupon),
      },
    }
  })

  const list = status === 'all' ? mapped : mapped.filter((x) => x.status === status)
  ok(res, { list, total: list.length })
})

export default router
