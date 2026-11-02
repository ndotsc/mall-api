-- 收藏/心愿单：用户对商品的收藏关系，复合唯一约束防止重复收藏
CREATE TABLE `Favorite` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `productId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Favorite_userId_productId_key` (`userId`, `productId`),
  INDEX `Favorite_userId_idx` (`userId`),
  INDEX `Favorite_productId_idx` (`productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
