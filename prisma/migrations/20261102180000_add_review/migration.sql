-- 商品评价表
CREATE TABLE `Review` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `reviewerName` VARCHAR(191) NOT NULL,
  `productId` INT NOT NULL,
  `rating` INT NOT NULL,
  `content` VARCHAR(191),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Review_productId_idx` ON `Review` (`productId`);
CREATE INDEX `Review_userId_idx` ON `Review` (`userId`);
