import { describe, it, expect, afterEach } from 'vitest'
import {
  toPublicUrl,
  toStoragePath,
  absolutize,
  relativize,
  publicOrigin,
} from '../src/utils/assetUrl.js'

const ORIGIN = 'http://localhost:3002'

describe('图片 URL 契约：接口返回完整 URL，库里存相对路径', () => {
  afterEach(() => {
    delete process.env.PUBLIC_ORIGIN
  })

  it('相对 /uploads 路径补成完整 URL', () => {
    expect(toPublicUrl('/uploads/a.png', ORIGIN)).toBe(`${ORIGIN}/uploads/a.png`)
  })

  it('外链 / data: / 已是完整 URL 的原样返回', () => {
    const external = 'https://picsum.photos/seed/p1/400/400'
    expect(toPublicUrl(external, ORIGIN)).toBe(external)
    expect(toPublicUrl('data:image/png;base64,AAA', ORIGIN)).toBe('data:image/png;base64,AAA')
    expect(toPublicUrl(`${ORIGIN}/uploads/a.png`, ORIGIN)).toBe(`${ORIGIN}/uploads/a.png`)
  })

  it('响应出口递归处理嵌套 list / 订单快照', () => {
    const data = {
      list: [{ id: 1, cover: '/uploads/a.png', name: '商品' }],
      url: '/uploads/b.png',
      total: 9900,
    }
    expect(absolutize(data, ORIGIN)).toEqual({
      list: [{ id: 1, cover: `${ORIGIN}/uploads/a.png`, name: '商品' }],
      url: `${ORIGIN}/uploads/b.png`,
      total: 9900,
    })
  })

  it('未拿到 origin 时保持原样（单测里的假 res 场景）', () => {
    expect(absolutize({ cover: '/uploads/a.png' }, '')).toEqual({ cover: '/uploads/a.png' })
  })

  it('请求入口把完整 URL 还原成相对路径，且幂等、保留 query', () => {
    expect(relativize({ cover: `${ORIGIN}/uploads/a.png?v=1`, price: 9900 })).toEqual({
      cover: '/uploads/a.png?v=1',
      price: 9900,
    })
    expect(toStoragePath('/uploads/a.png')).toBe('/uploads/a.png')
    expect(toStoragePath('https://picsum.photos/seed/p1/400/400')).toBe(
      'https://picsum.photos/seed/p1/400/400',
    )
  })

  it('无 /uploads/ 数据时返回原引用，不做深拷贝（短路）', () => {
    const plain = { list: [{ id: 1, name: '商品' }], total: 9900, ok: true }
    expect(absolutize(plain, ORIGIN)).toBe(plain)
    expect(relativize(plain)).toBe(plain)
  })

  it('有改动时返回新对象，且不污染原数据', () => {
    const data = { list: [{ cover: '/uploads/a.png' }] }
    const out = absolutize(data, ORIGIN)
    expect(out).not.toBe(data)
    expect(data.list[0].cover).toBe('/uploads/a.png')
    expect(out.list[0].cover).toBe(`${ORIGIN}/uploads/a.png`)
  })

  it('PUBLIC_ORIGIN 优先于当前请求推导', () => {
    const fakeReq = { protocol: 'http', get: (k) => (k === 'host' ? 'localhost:3002' : undefined) }
    expect(publicOrigin(fakeReq)).toBe('http://localhost:3002')
    process.env.PUBLIC_ORIGIN = 'https://cdn.example.com/'
    expect(publicOrigin(fakeReq)).toBe('https://cdn.example.com')
    expect(publicOrigin(null)).toBe('https://cdn.example.com')
  })
})
