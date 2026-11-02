import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { orderCreateSchema, orderStatusSchema } from '../validators/schemas.js'
import { computeCouponDiscount } from '../utils/coupon.js'

const router = Router()

router.post('/', authRequired, validateBody(orderCreateSchema), async (req, res) => {
  const userId = req.user.userId
  const { items, info, payType, remark, couponId } = req.body || {}

  const productIds = items.map(i => Number(i.productId))
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const map = new Map(products.map(p => [p.id, p]))

  let totalAmount = 0
  const orderItems = []
  for (const it of items) {
    const pid = Number(it.productId)
    const p = map.get(pid)
    if (!p) {
        throw new AppError('商品不存在或已下架', 400, 400)
    }
    const number = Math.min(99, Math.max(1, Number(it.number) || 1))
    totalAmount += p.price * number
    orderItems.push({ productId: pid, name: p.name, price: p.price, cover: p.cover, number })
  }

  // 优惠券校验：归属本人、未使用、未过期、门槛满足。校验失败直接抛错，不创建订单。
  let discountAmount = 0
  let userCouponId = null
  if (couponId != null) {
    const uc = await prisma.userCoupon.findUnique({
      where: { id: couponId },
      include: { coupon: true },
    })
    if (!uc || uc.userId !== userId) throw new AppError('优惠券不存在', 404, 404)
    if (uc.status !== 'unused') throw new AppError('优惠券已使用', 400, 400)
    if (uc.coupon.validTo < new Date()) throw new AppError('优惠券已过期', 400, 400)
    const { discount } = computeCouponDiscount(uc.coupon, totalAmount)
    if (discount <= 0) throw new AppError('优惠券不满足使用条件（如未满门槛）', 400, 400)
    discountAmount = discount
    userCouponId = uc.id
  }

  const payable = totalAmount - discountAmount
  const orderNo = 'NO' + Date.now() + Math.floor(Math.random() * 1000)

  // 事务：创建订单 + 标记券已用，保证一致性（避免券被重复用或订单创建失败但券已扣）
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        orderNo,
        totalAmount: payable, // 实付（已减优惠）
        discountAmount,
        userCouponId,
        payType: payType || 'wechat',
        status: 1,
        receiverName: info.name, receiverPhone: info.phone, address: info.address,
        remark: remark || null,
        items: { create: orderItems },
      },
      include: { items: true },
    })
    if (userCouponId != null) {
      await tx.userCoupon.update({
        where: { id: userCouponId },
        data: { status: 'used', usedAt: new Date(), orderId: created.id },
      })
    }
    return created
  })

  ok(res, { orderNo: order.orderNo, totalAmount: payable, discountAmount })
})

// 订单列表：普通用户只看自己的；管理员看全部。支持按 status 过滤 + 分页
// GET /api/orders?status=1&page=1&pageSize=20
router.get('/', authRequired, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 20), 100)
  const status = req.query.status ? Number(req.query.status) : undefined
  const where = {}
  if (req.user.role !== 2) where.userId = req.user.userId
  if (status) where.status = status

  const [list, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true },
    }),
    prisma.order.count({ where }),
  ])
  ok(res, { list, total, page, pageSize })
})

router.get('/:orderNo', authRequired, async (req, res) => {
  const where = { orderNo: req.params.orderNo }
  if (req.user.role !== 2) where.userId = req.user.userId
  const order = await prisma.order.findUnique({
    where,
    include: { items: true }
  })
  if (!order) {
    throw new AppError('订单不存在', 404, 404)
  }
  ok(res, order)
})

// 订单状态变更：本人（或管理员）可改。仅更新 status，不做流转校验（演示用）
// PATCH /api/orders/:orderNo/status  { status: 2 }
router.patch('/:orderNo/status', authRequired, validateBody(orderStatusSchema), async (req, res) => {
  const where = { orderNo: req.params.orderNo }
  if (req.user.role !== 2) where.userId = req.user.userId
  const order = await prisma.order.findUnique({ where })
  if (!order) {
    throw new AppError('订单不存在', 404, 404)
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: req.validated.status },
    include: { items: true },
  })
  ok(res, updated)
})

export default router
