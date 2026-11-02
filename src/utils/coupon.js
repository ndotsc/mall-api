// 优惠券金额计算与文案工具（后端统一规则，前端展示与下单校验共用同一套逻辑）。

// 根据券规则与订单小计（分）计算优惠额与应付。
// 注意：本函数只算「金额」，门槛（满减 threshold）不满足时 discount=0（即不可用），
// 过期/归属/已用等可用性判断由调用方负责。
export function computeCouponDiscount(coupon, subtotal) {
  let discount = 0
  if (coupon.type === 'full_reduction') {
    // 满减：仅当小计达到门槛才减
    if (subtotal >= coupon.threshold) discount = coupon.value
  } else if (coupon.type === 'instant') {
    // 立减：无门槛
    discount = coupon.value
  } else if (coupon.type === 'discount') {
    // 折扣：value=90 表示 9 折，折扣额 = 小计 * (100 - value) / 100
    discount = Math.floor((subtotal * (100 - coupon.value)) / 100)
    if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount)
  }
  if (discount < 0) discount = 0
  if (discount > subtotal) discount = subtotal // 优惠额不超过小计
  return { discount, payable: subtotal - discount }
}

// 生成券的人类可读标签，便于前端直接展示。
export function couponLabel(coupon) {
  const yuan = (fen) => (fen / 100).toFixed(fen % 100 === 0 ? 0 : 2)
  if (coupon.type === 'full_reduction') {
    return `满${yuan(coupon.threshold)}减${yuan(coupon.value)}`
  }
  if (coupon.type === 'instant') {
    return `立减${yuan(coupon.value)}`
  }
  if (coupon.type === 'discount') {
    const rate = (coupon.value / 10).toFixed(coupon.value % 10 === 0 ? 0 : 1)
    const cap = coupon.maxDiscount != null ? `（最高减${yuan(coupon.maxDiscount)}）` : ''
    return `${rate}折${cap}`
  }
  return coupon.name
}
