import { z } from 'zod'

// 商品：price/categoryId 用 coerce，兼容前端可能传来的字符串
export const productCreateSchema = z.object({
  name: z.string().min(1, { message: '名称必填' }),
  price: z.coerce.number().int({ message: '价格需为整数（单位：分）' }).nonnegative({ message: '价格不能为负' }),
  cover: z.string().optional(),
  desc: z.string().optional(),
  categoryId: z.coerce.number().int({ message: '分类 ID 需为整数' }).optional(),
})
export const productUpdateSchema = productCreateSchema.partial()

// 文章
export const articleCreateSchema = z.object({
  title: z.string().min(1, { message: '标题必填' }),
  cover: z.string().min(1, { message: '封面必填' }),
  summary: z.string().min(1, { message: '摘要必填' }),
  content: z.string().min(1, { message: '正文必填' }),
  status: z.coerce.number().int().optional(),
})
export const articleUpdateSchema = articleCreateSchema.partial()

// 下单：服务端仍按库内价重算金额，这里只校验入参结构
export const orderCreateSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive({ message: '商品 ID 无效' }),
        number: z.coerce.number().int().positive({ message: '数量需为正整数' }),
      })
    )
    .min(1, { message: '订单中没有商品' }),
  info: z.object({
    name: z.string().min(1, { message: '收货人必填' }),
    phone: z.string().min(1, { message: '手机号必填' }),
    address: z.string().min(1, { message: '地址必填' }),
  }),
  payType: z.string().optional(),
  remark: z.string().optional(),
})

// 账号
export const registerSchema = z.object({
  username: z.string().min(3, { message: '用户名至少 3 个字符' }).max(32, { message: '用户名至多 32 个字符' }),
  password: z.string().min(6, { message: '密码至少 6 位' }).max(64, { message: '密码至多 64 位' }),
  nickname: z.string().max(32).optional(),
})
export const loginSchema = z.object({
  username: z.string().min(1, { message: '用户名必填' }),
  password: z.string().min(1, { message: '密码必填' }),
})
