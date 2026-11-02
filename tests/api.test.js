import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import prisma from '../src/prisma.js'
import { hashPassword } from '../src/middleware/auth.js'

const BASE = '/api'
const rand = () => Math.floor(Math.random() * 1e9)
let adminToken = ''
let productId = null
const created = { users: [], products: [], orders: [], reviews: [] }

beforeAll(async () => {
  await prisma.$connect()
  // 幂等创建一个管理员(role=2)用于需要 admin 的用例
  const pwd = 'Admin@123'
  const admin = await prisma.user.upsert({
    where: { username: '__test_admin__' },
    update: {},
    create: { username: '__test_admin__', password: await hashPassword(pwd), role: 2, nickname: 'TA' },
  })
  created.users.push(admin.id)
  const login = await request(app)
    .post(`${BASE}/auth/login`)
    .send({ username: '__test_admin__', password: pwd })
  adminToken = login.body.data.token
})

afterAll(async () => {
  if (created.orders.length) await prisma.order.deleteMany({ where: { orderNo: { in: created.orders } } })
  if (created.products.length) await prisma.product.deleteMany({ where: { id: { in: created.products } } })
  if (created.reviews.length) await prisma.review.deleteMany({ where: { id: { in: created.reviews } } })
  if (created.users.length) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: created.users } } })
    await prisma.user.deleteMany({ where: { id: { in: created.users } } })
  }
  await prisma.$disconnect()
})

describe('auth', () => {
  it('register 成功并返回 token', async () => {
    const u = 'u_' + rand()
    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send({ username: u, password: 'secret1' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(typeof res.body.data.token).toBe('string')
    created.users.push(res.body.data.user.id)
  })

  it('重复用户名 -> 400', async () => {
    const u = 'dup_' + rand()
    await request(app).post(`${BASE}/auth/register`).send({ username: u, password: 'secret1' })
    const dup = await prisma.user.findUnique({ where: { username: u } })
    if (dup) created.users.push(dup.id)
    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send({ username: u, password: 'secret1' })
    expect(res.status).toBe(400)
  })

  it('弱密码(<6) -> 400 (zod)', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send({ username: 'weak_' + rand(), password: '123' })
    expect(res.status).toBe(400)
  })

  it('错误密码登录 -> 401', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ username: '__test_admin__', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('me 无 token -> 401', async () => {
    const res = await request(app).get(`${BASE}/auth/me`)
    expect(res.status).toBe(401)
  })

  it('me 带 token -> 200', async () => {
    const res = await request(app)
      .get(`${BASE}/auth/me`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe('__test_admin__')
  })
})

describe('auth refresh', () => {
  it('注册返回 refreshToken，且刷新后新 access 可访问 /me', async () => {
    const u = 'rf_' + rand()
    const r = await request(app).post(`${BASE}/auth/register`).send({ username: u, password: 'secret1' })
    created.users.push(r.body.data.user.id)
    expect(typeof r.body.data.refreshToken).toBe('string')
    const refresh = await request(app).post(`${BASE}/auth/refresh`).send({ refreshToken: r.body.data.refreshToken })
    expect(refresh.status).toBe(200)
    expect(typeof refresh.body.data.token).toBe('string')
    const me = await request(app)
      .get(`${BASE}/auth/me`)
      .set('Authorization', `Bearer ${refresh.body.data.token}`)
    expect(me.status).toBe(200)
  })

  it('refresh 轮换：旧 refresh 二次使用 -> 401（复用检测，整族吊销）', async () => {
    const u = 'rf2_' + rand()
    const r = await request(app).post(`${BASE}/auth/register`).send({ username: u, password: 'secret1' })
    created.users.push(r.body.data.user.id)
    const rt = r.body.data.refreshToken
    const first = await request(app).post(`${BASE}/auth/refresh`).send({ refreshToken: rt })
    expect(first.status).toBe(200)
    const reuse = await request(app).post(`${BASE}/auth/refresh`).send({ refreshToken: rt })
    expect(reuse.status).toBe(401)
  })

  it('refresh 缺参 -> 400 (zod)', async () => {
    const res = await request(app).post(`${BASE}/auth/refresh`).send({})
    expect(res.status).toBe(400)
  })
})

describe('products (需要管理员)', () => {
  it('列表公开可访问 -> 200', async () => {
    const res = await request(app).get(`${BASE}/products`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.list)).toBe(true)
  })

  it('无 token 创建 -> 401', async () => {
    const res = await request(app).post(`${BASE}/products`).send({ name: 'x', price: 100 })
    expect(res.status).toBe(401)
  })

  it('普通用户创建 -> 403', async () => {
    const u = 'pu_' + rand()
    const r = await request(app).post(`${BASE}/auth/register`).send({ username: u, password: 'secret1' })
    created.users.push(r.body.data.user.id)
    const res = await request(app)
      .post(`${BASE}/products`)
      .set('Authorization', `Bearer ${r.body.data.token}`)
      .send({ name: 'x', price: 100 })
    expect(res.status).toBe(403)
  })

  it('管理员创建 -> 200', async () => {
    const res = await request(app)
      .post(`${BASE}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '测试商品_' + rand(), price: 9900 })
    expect(res.status).toBe(200)
    productId = res.body.data.id
    created.products.push(productId)
  })

  it('缺少名称 -> 400 (zod)', async () => {
    const res = await request(app)
      .post(`${BASE}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 9900 })
    expect(res.status).toBe(400)
  })
})

describe('products 筛选 / 排序', () => {
  // 自建 2 个分类 + 3 个商品，覆盖「分类 / 价格梯度 / 组合」，便于精确断言。
  let catA, catB, p1, p2, p3

  beforeAll(async () => {
    catA = await prisma.category.create({ data: { name: 'flt_catA_' + rand(), sort: 0 } })
    catB = await prisma.category.create({ data: { name: 'flt_catB_' + rand(), sort: 1 } })
    p1 = await prisma.product.create({ data: { name: 'flt_a_cheap_' + rand(), price: 100, categoryId: catA.id } })
    p2 = await prisma.product.create({ data: { name: 'flt_a_exp_' + rand(), price: 500, categoryId: catA.id } })
    p3 = await prisma.product.create({ data: { name: 'flt_b_mid_' + rand(), price: 900, categoryId: catB.id } })
    created.products.push(p1.id, p2.id, p3.id)
  })

  afterAll(async () => {
    // 先删自建商品（避免外键约束），再删自建分类。
    // 全局 afterAll 还会按 created.products 再删一次本用例商品（已不存在，deleteMany 无影响）。
    await prisma.product.deleteMany({ where: { id: { in: [p1.id, p2.id, p3.id] } } })
    await prisma.category.deleteMany({ where: { id: { in: [catA.id, catB.id] } } })
  })

  it('按 categoryId 筛选返回预期条数', async () => {
    const res = await request(app).get(`${BASE}/products?keyword=flt_&categoryId=${catA.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(2)
    expect(res.body.data.list.every((p) => p.categoryId === catA.id)).toBe(true)
  })

  it('按价格区间 minPrice / maxPrice 筛选', async () => {
    const res = await request(app).get(`${BASE}/products?keyword=flt_&minPrice=100&maxPrice=500`)
    expect(res.status).toBe(200)
    // 仅 p1(100) 与 p2(500) 命中；p3(900) 超出区间
    expect(res.body.data.total).toBe(2)
    expect(res.body.data.list.every((p) => p.price >= 100 && p.price <= 500)).toBe(true)
  })

  it('按 price_asc 排序后列表价格非递减', async () => {
    const res = await request(app).get(`${BASE}/products?keyword=flt_&sort=price_asc`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(3)
    const prices = res.body.data.list.map((p) => p.price)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
    }
  })
})

describe('orders', () => {
  it('无 token 下单 -> 401', async () => {
    const res = await request(app)
      .post(`${BASE}/orders`)
      .send({ items: [{ productId: 1, number: 1 }], info: { name: 'a', phone: 'b', address: 'c' } })
    expect(res.status).toBe(401)
  })

  it('参数错误(空 items) -> 400 (zod)', async () => {
    const u = 'ou_' + rand()
    const r = await request(app).post(`${BASE}/auth/register`).send({ username: u, password: 'secret1' })
    created.users.push(r.body.data.user.id)
    const res = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${r.body.data.token}`)
      .send({ items: [], info: { name: 'a', phone: 'b', address: 'c' } })
    expect(res.status).toBe(400)
  })

  it('正常下单 -> 200 并正确落库(金额重算/归属用户)', async () => {
    const u = 'ok_' + rand()
    const r = await request(app).post(`${BASE}/auth/register`).send({ username: u, password: 'secret1' })
    created.users.push(r.body.data.user.id)
    const res = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${r.body.data.token}`)
      .send({
        items: [{ productId, number: 2 }],
        info: { name: '张三', phone: '13800000000', address: '北京市海淀区' },
      })
    expect(res.status).toBe(200)
    expect(typeof res.body.data.orderNo).toBe('string')
    created.orders.push(res.body.data.orderNo)

    const order = await prisma.order.findUnique({ where: { orderNo: res.body.data.orderNo } })
    expect(order.userId).toBe(r.body.data.user.id)
    expect(order.totalAmount).toBe(9900 * 2) // 服务端按库内价重算，不信任前端
  })
})

describe('reviews', () => {
  it('未登录提交评价 -> 401', async () => {
    const res = await request(app)
      .post(`${BASE}/reviews`)
      .send({ productId, rating: 5, content: '好' })
    expect(res.status).toBe(401)
  })

  it('缺 rating -> 400 (zod)', async () => {
    const res = await request(app)
      .post(`${BASE}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, content: '好' })
    expect(res.status).toBe(400)
  })

  it('提交有效评价 -> 200，列表公开可见且统计正确', async () => {
    const create = await request(app)
      .post(`${BASE}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, rating: 5, content: '质量不错' })
    expect(create.status).toBe(200)
    expect(typeof create.body.data.id).toBe('number')
    created.reviews.push(create.body.data.id)

    const list = await request(app).get(`${BASE}/reviews?productId=${productId}`)
    expect(list.status).toBe(200)
    expect(list.body.data.total).toBeGreaterThanOrEqual(1)
    expect(list.body.data.stats.averageRating).toBe(5)
    expect(Array.isArray(list.body.data.list)).toBe(true)
  })

  it('我的评价 -> 200（含刚提交的那条）', async () => {
    const me = await request(app)
      .get(`${BASE}/reviews/me`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(me.status).toBe(200)
    expect(me.body.data.list.some((r) => r.productId === productId)).toBe(true)
  })
})
