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
  couponId: z.coerce.number().int().positive({ message: '优惠券 ID 无效' }).optional(),
})

// 订单状态变更：1待付款 2待发货 3待收货 4已完成 5已取消
export const orderStatusSchema = z.object({
  status: z.coerce.number().int().min(1).max(5, { message: '状态无效' }),
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

// 微信登录：小程序 / App 微信登录拿到的临时 code
export const wxLoginSchema = z.object({
  code: z.string().min(1, { message: 'code 不能为空' }),
})

// 公众号网页授权（H5 微信一键登录）拿到的临时 code
export const wxOauthSchema = z.object({
  code: z.string().min(1, { message: '微信授权 code 必填' }),
})

// 刷新令牌：用长期 refresh token 换新的访问令牌
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, { message: 'refresh token 不能为空' }),
})

// 购物车：productId/number 用 coerce，兼容前端可能传来的字符串
export const cartAddSchema = z.object({
  productId: z.coerce.number().int().positive({ message: '商品 ID 无效' }),
  number: z.coerce
    .number()
    .int({ message: '数量需为整数' })
    .positive({ message: '数量需为正整数' })
    .max(99, { message: '单次数量不能超过 99' })
    .default(1),
})
export const cartUpdateSchema = z.object({
  number: z.coerce
    .number()
    .int({ message: '数量需为整数' })
    .positive({ message: '数量需为正整数' })
    .max(99, { message: '数量不能超过 99' }),
})

// 收货地址：手机号校验大陆 11 位手机号；姓名/详细地址加最大长度
export const addressSchema = z.object({
  name: z.string().min(1, { message: '收货人必填' }).max(20, { message: '收货人姓名过长' }),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, { message: '手机号格式不正确（须为大陆 11 位手机号）' }),
  detail: z.string().min(1, { message: '详细地址必填' }).max(200, { message: '详细地址过长' }),
  isDefault: z.boolean().optional().default(false),
})
export const addressUpdateSchema = addressSchema.partial()

// 商品评价：rating 必填 1-5；content 可选（最长 500）
export const reviewCreateSchema = z.object({
  productId: z.coerce.number().int().positive({ message: '商品 ID 无效' }),
  rating: z.coerce.number().int().min(1).max(5, { message: '评分需在 1-5 之间' }),
  content: z.string().max(500, { message: '评价内容过长（≤500 字）' }).optional(),
})

// 收藏：productId 用 coerce，兼容前端可能传来的字符串
export const favoriteCreateSchema = z.object({
  productId: z.coerce.number().int().positive({ message: '商品 ID 无效' }),
})

// 优惠券模板（管理员建券）：金额单位均为分；折扣券 value 为折扣率*100（90=9折）
export const couponCreateSchema = z
  .object({
    name: z.string().min(1, { message: '券名称必填' }),
    type: z.enum(['full_reduction', 'discount', 'instant'], { message: '券类型无效' }),
    threshold: z.coerce.number().int({ message: '门槛需为整数（分）' }).nonnegative({ message: '门槛不能为负' }).default(0),
    value: z.coerce.number().int({ message: '优惠值需为整数' }).positive({ message: '优惠值必须为正整数' }),
    maxDiscount: z.coerce.number().int().positive({ message: '折扣封顶须为正整数（分）' }).optional(),
    validFrom: z.coerce.date({ message: '开始时间无效' }),
    validTo: z.coerce.date({ message: '结束时间无效' }),
    total: z.coerce.number().int().default(-1), // -1 不限量
    perUserLimit: z.coerce.number().int().positive({ message: '每人限领须为正整数' }).default(1),
  })
  .refine((d) => d.validTo > d.validFrom, { message: '结束时间须晚于开始时间', path: ['validTo'] })
  .refine((d) => d.type !== 'full_reduction' || d.threshold > 0, {
    message: '满减券门槛须大于 0',
    path: ['threshold'],
  })
  .refine((d) => d.type !== 'discount' || (d.value > 0 && d.value < 100), {
    message: '折扣券 value 需为 1-99（表示 0.01-0.99 折）',
    path: ['value'],
  })
