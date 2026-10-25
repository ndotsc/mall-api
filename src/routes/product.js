import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired, adminRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { productCreateSchema, productUpdateSchema } from '../validators/schemas.js'

const router = Router()

// 内存假数据：2.1 阶段没有数据库，先用一个数组代替
// 等后面接真数据库（mall-server 用的 Prisma）时，这里换成查库
// const products = []

// 列表接口：支持分页
// GET /api/products?page=1&pageSize=2
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 50), 50)
  
  const keyword = req.query.keyword?.toString().trim()
  const where = keyword ? { name: { contains: keyword } } :  {}
  const [list, total] = await Promise.all([
    prisma.product.findMany({ where, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ])
  ok(res, { list, total, page, pageSize })
})

// 详情接口
// GET /api/products/1
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  // const product = products.find((a) => a.id === id)
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) {
    throw new AppError('商品不存在', 404, 404)
  }
  ok(res, product)
})

router.post('/', authRequired, adminRequired, validateBody(productCreateSchema), async (req, res) => {
  // req.validated 已含校验通过且 coerce 好的字段（name/price 必填，其余可选）
  const product = await prisma.product.create({ data: req.validated })
  ok(res, product)
})

router.put('/:id', authRequired, adminRequired, validateBody(productUpdateSchema), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await prisma.product.findUnique({ where: { id } })
  if (!exists) throw new AppError('商品不存在', 404, 404)

  // validateBody 已用 productUpdateSchema（= productCreateSchema.partial()）校验，
  // req.validated 仅含客户端实际传来的字段，且数值已被 coerce 转好，
  // 直接作为 Prisma 的部分更新数据即可（没传的字段不会出现在对象里 → 保持原值）。
  const product = await prisma.product.update({ where: { id }, data: req.validated })
  ok(res, product)
})

router.delete('/:id', authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id)
  const exists = await prisma.product.findUnique({ where: { id } })
  if (!exists) throw new AppError('商品不存在', 404, 404)
  await prisma.product.delete({ where: { id } })
  ok(res, { id })
})

export default router
