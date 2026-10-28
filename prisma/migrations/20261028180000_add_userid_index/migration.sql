-- 为 Cart.userId / Address.userId 建索引，加速按用户维度的查询
-- （购物车/地址列表、默认地址唯一性更新等 where:{ userId } 不再全表扫描）
CREATE INDEX `Cart_userId_idx` ON `Cart` (`userId`);
CREATE INDEX `Address_userId_idx` ON `Address` (`userId`);
