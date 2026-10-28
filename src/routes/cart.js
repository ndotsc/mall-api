import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { cartAddSchema, cartUpdateSchema } from '../validators/schemas.js'

const router = Router()

// 购物车列表：只返回当前用户自己的条目，并手动关联商品快照（名称/单价/封面）
// Cart 模型未建外键关系（与 OrderItem 的快照写法一致），故先取购物车、再批量取商品映射
// GET /api/cart
router.get('/', authRequired, async (req, res) => {
  const items = await prisma.cart.findMany({
    where: { userId: req.user.userId },
    orderBy: { id: 'desc' },
  })
  let list = items
  if (items.length) {
    const ids = [...new Set(items.map((i) => i.productId))]
    const products = await prisma.product.findMany({ where: { id: { in: ids } } })
    const pmap = new Map(products.map((p) => [p.id, p]))
    list = items.map((i) => {
      const p = pmap.get(i.productId)
      return {
        ...i,
        product: p ? { id: p.id, name: p.name, price: p.price, cover: p.cover } : null,
      }
    })
  }
  ok(res, list)
})

// 加入购物车：同一用户 + 同一商品，数量累加；否则新建
// POST /api/cart  { productId, number? }
router.post('/', authRequired, validateBody(cartAddSchema), async (req, res) => {
  const userId = req.user.userId
  const { productId, number } = req.validated

  // 校验商品存在（已下架/删除的不能加）
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw new AppError('商品不存在或已下架', 400, 400)

  const exists = await prisma.cart.findFirst({ where: { userId, productId } })
  const cart = exists
    ? await prisma.cart.update({
        where: { id: exists.id },
        data: { number: exists.number + number },
      })
    : await prisma.cart.create({ data: { userId, productId, number } })
  ok(res, cart)
})

// 修改数量（直接设为传入值，购物车页 +/- 按钮用）
// PUT /api/cart/:id  { number }
router.put('/:id', authRequired, validateBody(cartUpdateSchema), async (req, res) => {
  const id = Number(req.params.id)
  const cart = await prisma.cart.findFirst({ where: { id, userId: req.user.userId } })
  if (!cart) throw new AppError('购物车项不存在', 404, 404)
  const updated = await prisma.cart.update({
    where: { id },
    data: { number: req.validated.number },
  })
  ok(res, updated)
})

// 删除某一项
// DELETE /api/cart/:id
router.delete('/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id)
  const cart = await prisma.cart.findFirst({ where: { id, userId: req.user.userId } })
  if (!cart) throw new AppError('购物车项不存在', 404, 404)
  await prisma.cart.delete({ where: { id } })
  ok(res, { id })
})

// 清空当前用户购物车
// DELETE /api/cart
router.delete('/', authRequired, async (req, res) => {
  const { count } = await prisma.cart.deleteMany({ where: { userId: req.user.userId } })
  ok(res, { count })
})

export default router
