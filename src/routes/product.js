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

// 列表接口：支持分页 / 关键词 / 分类 / 价格区间 / 排序
// GET /api/products
//   ?page=1&pageSize=50
//   &keyword=手机          （name contains 模糊匹配）
//   &categoryId=2          （精确分类）
//   &minPrice=0&maxPrice=999900   （价格区间，单位：分；任一可单独传）
//   &sort=created_desc|created_asc|price_asc|price_desc  （默认 created_desc）
// 说明：deletedAt 过滤由 prisma $extends 自动注入，这里无需额外处理。
// query 采用「手动解析」风格（与现有代码一致，不引入 zod）。
const SORT_MAP = {
  created_desc: { createdAt: 'desc' },
  created_asc: { createdAt: 'asc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
}

router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 50), 50)

  // 关键词：name 模糊匹配（与现状一致）
  const keyword = req.query.keyword?.toString().trim()
  const where = keyword ? { name: { contains: keyword } } : {}

  // 分类：转整数，空串 / null / NaN / 小数等非法值一律忽略
  // （注意 Number('')===0 的陷阱：必须先把空串/ null 判掉，否则会误写成 where.categoryId=0）
  const rawCat = req.query.categoryId
  const categoryId = rawCat === '' || rawCat == null ? NaN : Number(rawCat)
  if (Number.isInteger(categoryId)) {
    where.categoryId = categoryId
  }

  // 价格区间：单位「分」，转数字后需为有限非负数才生效（任一可单独传）
  // 同样先排除空串 / null，避免 Number('')===0 误写 gte:0 / lte:0
  const rawMin = req.query.minPrice
  const minPrice = rawMin === '' || rawMin == null ? NaN : Number(rawMin)
  if (Number.isFinite(minPrice) && minPrice >= 0) {
    where.price = { ...(where.price || {}), gte: Math.floor(minPrice) }
  }
  const rawMax = req.query.maxPrice
  const maxPrice = rawMax === '' || rawMax == null ? NaN : Number(rawMax)
  if (Number.isFinite(maxPrice) && maxPrice >= 0) {
    where.price = { ...(where.price || {}), lte: Math.floor(maxPrice) }
  }

  // 排序：仅接受枚举中的合法值，非法或默认都回退到 created_desc
  const sort = SORT_MAP[req.query.sort] ? req.query.sort : 'created_desc'
  const orderBy = SORT_MAP[sort]

  const [list, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
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
  // 软删除：置 deletedAt，而非物理删除（查询层已自动过滤 deletedAt != null 的记录）
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } })
  ok(res, { id, deleted: true })
})

export default router
