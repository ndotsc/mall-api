import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import prisma from '../src/prisma.js'
import { hashPassword } from '../src/middleware/auth.js'

const BASE = '/api'
const rand = () => Math.floor(Math.random() * 1e9)
let adminToken = ''
let productId = null
const created = { users: [], products: [], orders: [] }

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
  if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } })
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
