import { Router } from 'express'
import { ok } from '../utils/response.js'
import prisma from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { AppError } from '../utils/AppError.js'
import { validateBody } from '../middleware/validate.js'
import { addressSchema, addressUpdateSchema } from '../validators/schemas.js'

const router = Router()

// 地址列表：默认地址排最前
// GET /api/addresses
router.get('/', authRequired, async (req, res) => {
  const list = await prisma.address.findMany({
    where: { userId: req.user.userId },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
  })
  ok(res, list)
})

// 新增地址；若设为默认，则把该用户其它地址全部取消默认（事务保证唯一）
// POST /api/addresses  { name, phone, detail, isDefault? }
router.post('/', authRequired, validateBody(addressSchema), async (req, res) => {
  const userId = req.user.userId
  const { name, phone, detail, isDefault } = req.validated
  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    }
    return tx.address.create({
      data: { userId, name, phone, detail, isDefault: !!isDefault },
    })
  })
  ok(res, created)
})

// 修改地址；同理保证默认地址唯一，且只能改自己的地址
// PUT /api/addresses/:id  { name?, phone?, detail?, isDefault? }
router.put('/:id', authRequired, validateBody(addressUpdateSchema), async (req, res) => {
  const userId = req.user.userId
  const id = Number(req.params.id)
  const existing = await prisma.address.findFirst({ where: { id, userId } })
  if (!existing) throw new AppError('地址不存在', 404, 404)

  const { isDefault } = req.validated
  const updated = await prisma.$transaction(async (tx) => {
    if (isDefault === true) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      })
    }
    return tx.address.update({ where: { id }, data: req.validated })
  })
  ok(res, updated)
})

// 删除地址；若删掉的是默认地址，则自动把剩下的第一条提升为默认
// DELETE /api/addresses/:id
router.delete('/:id', authRequired, async (req, res) => {
  const userId = req.user.userId
  const id = Number(req.params.id)
  const existing = await prisma.address.findFirst({ where: { id, userId } })
  if (!existing) throw new AppError('地址不存在', 404, 404)

  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } })
    if (existing.isDefault) {
      const first = await tx.address.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
      })
      if (first) {
        await tx.address.update({ where: { id: first.id }, data: { isDefault: true } })
      }
    }
  })
  ok(res, { id })
})

export default router
