import { Router } from 'express'
import { ok } from '../utils/response.js'
import articleRoutes from './article.js'
import productRoutes from './product.js'
import orderRoutes from './order.js'
import uploadRoutes from './upload.js'
import authRoutes from './auth.js'
import categoryRoutes from './category.js'

const router = Router()

// 健康检查：用来确认后端活着，前端/运维会定时调它
router.get('/health', (req, res) => {
  ok(res, { time: new Date().toISOString() })
})

// 把文章相关接口挂到 /articles 下
router.use('/articles', articleRoutes)
router.use('/products', productRoutes)
router.use('/orders', orderRoutes)
router.use('/upload', uploadRoutes)
router.use('/auth', authRoutes)
router.use('/categories', categoryRoutes)

export default router
