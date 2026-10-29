import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { orderCreateSchema, orderStatusSchema } from '../validators/schemas.js'

const router = Router()

router.post('/', authRequired, validateBody(orderCreateSchema), async (req, res) => {
  const userId = req.user.userId
  const { items, info, payType, remark } = req.body || {}

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

  const orderNo = 'NO' + Date.now() + Math.floor(Math.random() * 1000)
  const order = await prisma.order.create({
    data: {
        userId,
        orderNo, totalAmount,
        payType: payType || 'wechat',
        status: 1,
        receiverName: info.name, receiverPhone: info.phone, address: info.address,
        remark: remark || null,
        items: { create: orderItems },
    },
    include: { items: true },
  })
  ok(res, { orderNo: order.orderNo })
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
