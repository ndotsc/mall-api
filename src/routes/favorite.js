import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { favoriteCreateSchema } from '../validators/schemas.js'

const router = Router()

// 我的收藏列表（带商品快照：id/name/price/cover）。
// 软删商品会被 prisma $extends 自动过滤 → 对应 favorite 的 product 为 null，前端按「已下架」处理。
// GET /api/favorites?page=1&pageSize=50
router.get('/', authRequired, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 50), 50)
  const where = { userId: req.user.userId }
  const [list, total] = await Promise.all([
    prisma.favorite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { product: { select: { id: true, name: true, price: true, cover: true } } },
    }),
    prisma.favorite.count({ where }),
  ])
  ok(res, { list, total, page, pageSize })
})

// 是否收藏某商品（详情页心形初始态）
// GET /api/favorites/check?productId=1
router.get('/check', authRequired, async (req, res) => {
  const productId = Number(req.query.productId)
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new AppError('productId 无效', 400, 400)
  }
  const fav = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: req.user.userId, productId } },
  })
  ok(res, { favorited: !!fav })
})

// 收藏某商品（幂等：已收藏则返回已有记录，不报错）
// POST /api/favorites  { productId }
router.post('/', authRequired, validateBody(favoriteCreateSchema), async (req, res) => {
  const userId = req.user.userId
  const productId = req.validated.productId
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw new AppError('商品不存在', 404, 404)
  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
  })
  if (existing) return ok(res, existing)
  const created = await prisma.favorite.create({ data: { userId, productId } })
  ok(res, created)
})

// 取消收藏（幂等：未收藏也返回成功）
// DELETE /api/favorites/:productId
router.delete('/:productId', authRequired, async (req, res) => {
  const userId = req.user.userId
  const productId = Number(req.params.productId)
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new AppError('productId 无效', 400, 400)
  }
  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
  })
  if (existing) {
    await prisma.favorite.delete({ where: { userId_productId: { userId, productId } } })
  }
  ok(res, { productId, removed: !!existing })
})

export default router
