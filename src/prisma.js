import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// PrismaClient 必须单例：别在每个请求里 new 一个，否则连接数会爆
const prisma = new PrismaClient()

// 软删除：对 User / Product 的读/改/删操作，自动在 where 里补上 deletedAt: null，
// 业务层无需关心，已「删除」的记录在查询结果中天然不可见。
// 约定：真正删除（物理删除）请改用「置 deletedAt = now()」；目前只有列 + 查询拦截，
// 具体删除接口在需要时再实现为 UPDATE ... SET deletedAt = NOW()。
const SOFT_DELETE_MODELS = new Set(['User', 'Product'])
const SOFT_DELETE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
])

const prismaSoft = prisma.$extends({
  query: {
    $allModels({ model, operation, args, query }) {
      if (
        SOFT_DELETE_MODELS.has(model) &&
        SOFT_DELETE_OPS.has(operation) &&
        args &&
        args.where !== undefined
      ) {
        // 仅在没显式传 deletedAt 时才注入，支持「查已删除」之类的特殊场景
        if (args.where.deletedAt === undefined) {
          args.where = { ...args.where, deletedAt: null }
        }
      }
      return query(args)
    },
  },
})

export default prismaSoft
