import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired, adminRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { articleCreateSchema, articleUpdateSchema } from '../validators/schemas.js'

const router = Router()

// 内存假数据：2.1 阶段没有数据库，先用一个数组代替
// 等后面接真数据库（mall-server 用的 Prisma）时，这里换成查库
// const articles = [
//   { id: 1, title: 'Vue3 组合式 API 入门', summary: 'ref 与 reactive 的区别', createdAt: '2026-01-10' },
//   { id: 2, title: 'Pinia 状态管理实战', summary: '购物车如何用 store 管理', createdAt: '2026-01-12' },
//   { id: 3, title: 'Express 中间件机制', summary: '请求是怎么一路流到路由的', createdAt: '2026-01-15' },
//   { id: 4, title: '前端路由 history 模式', summary: 'createWebHistory 部署要点', createdAt: '2026-01-18' },
//   { id: 5, title: 'CSS Flex 与 Grid', summary: '两种布局该怎么选', createdAt: '2026-01-20' },
// ]

// 列表接口：支持分页
// GET /api/articles?page=1&pageSize=2
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 50), 50)
  
  const keyword = req.query.keyword?.toString().trim()
  const where = keyword ? { title: { contains: keyword } } : {}
  const [list, total] = await Promise.all([
    prisma.article.findMany({ where, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.article.count({ where }),
  ])
  ok(res, { list, total, page, pageSize })
})

// 详情接口
// GET /api/articles/1
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) {
    throw new AppError('文章不存在', 404, 404)
  }
  ok(res, article)
})

router.post('/', authRequired, adminRequired, validateBody(articleCreateSchema), async (req, res) => {
  // req.validated 已含校验通过且 coerce 好的字段；status 默认置 1
  const article = await prisma.article.create({ data: { ...req.validated, status: 1 } })
  ok(res, article)
})

router.put('/:id', authRequired, adminRequired, validateBody(articleUpdateSchema), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await prisma.article.findUnique({ where: { id } })
  if (!exists) throw new AppError('文章不存在', 404, 404)

  // validateBody 已用 articleUpdateSchema（= articleCreateSchema.partial()）校验，
  // req.validated 仅含客户端实际传来的字段，直接作为 Prisma 部分更新数据。
  const article = await prisma.article.update({ where: { id }, data: req.validated })
  ok(res, article)
})

router.delete('/:id', authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id)
  const exists = await prisma.article.findUnique({ where: { id } })
  if (!exists) throw new AppError('文章不存在', 404, 404)
  await prisma.article.delete({ where: { id } })
  ok(res, { id })
})

export default router
