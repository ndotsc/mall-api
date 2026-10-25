import { Router } from "express"
import prisma from "../prisma.js"
import { ok } from '../utils/response.js'

const router = Router()
router.get('/', async (req, res) => {
    ok(res, await prisma.category.findMany())
})

export default router