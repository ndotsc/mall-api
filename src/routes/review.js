import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { reviewCreateSchema } from '../validators/schemas.js'

const router = Router()

// 我的评价（需登录）：GET /api/reviews/me?page=&pageSize=
router.get('/me', authRequired, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 10), 50)
  const where = { userId: req.user.userId }
  const [list, total] = await Promise.all([
    prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.review.count({ where }),
  ])
  ok(res, { list, total, page, pageSize })
})

// 商品评价列表（公开）：GET /api/reviews?productId=&page=&pageSize=
// 附带统计：平均评分 + 评价总数，方便商品详情页直接展示
router.get('/', async (req, res) => {
  const productId = Number(req.query.productId)
  if (!productId) throw new AppError('缺少 productId', 400, 400)
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 10), 50)
  const where = { productId }
  const [list, total, agg] = await Promise.all([
    prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ where, _avg: { rating: true } }),
  ])
  const averageRating = agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0
  ok(res, { list, total, page, pageSize, stats: { total, averageRating } })
})

// 提交评价（需登录）：POST /api/reviews
router.post('/', authRequired, validateBody(reviewCreateSchema), async (req, res) => {
  const { productId, rating, content } = req.validated
  // 商品必须存在（已软删的商品会被自动过滤，查不到即 404）
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw new AppError('商品不存在', 404, 404)
  // 用户名快照：评价展示用，避免查询时 join 含敏感字段的 User 表
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { username: true } })
  const review = await prisma.review.create({
    data: {
      userId: req.user.userId,
      reviewerName: user?.username || '匿名用户',
      productId,
      rating,
      content: content ?? null,
    },
  })
  ok(res, review)
})

export default router
