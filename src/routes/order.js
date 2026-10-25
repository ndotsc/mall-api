import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { orderCreateSchema } from '../validators/schemas.js'

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

export default router
