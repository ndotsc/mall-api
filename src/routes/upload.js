import { Router } from 'express'
import { ok } from '../utils/response.js'
import { AppError } from '../utils/AppError.js'
import upload from '../utils/upload.js'

const router = Router()

router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) {
        throw new AppError('没有收到文件', 400, 400)
    }

    ok(res, { url: '/uploads/' + req.file.filename })
})

export default router