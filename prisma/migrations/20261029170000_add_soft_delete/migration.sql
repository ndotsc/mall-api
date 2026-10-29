-- 软删除：给 User / Product 加 deletedAt 标记列 + 索引
-- 与 prisma/schema.prisma 的改动保持一致；本机走「raw SQL + migrate resolve --applied」流程。
ALTER TABLE `User` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `Product` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `User_deletedAt_idx` ON `User`(`deletedAt`);
CREATE INDEX `Product_deletedAt_idx` ON `Product`(`deletedAt`);
