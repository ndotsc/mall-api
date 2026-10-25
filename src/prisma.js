import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// PrismaClient 必须单例：别在每个请求里 new 一个，否则连接数会爆
const prisma = new PrismaClient()

export default prisma
