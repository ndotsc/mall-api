-- 优惠券系统：券模板 + 用户券 + 订单优惠字段
CREATE TABLE `Coupon` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `threshold` INT NOT NULL DEFAULT 0,
  `value` INT NOT NULL,
  `maxDiscount` INT NULL,
  `validFrom` DATETIME(3) NOT NULL,
  `validTo` DATETIME(3) NOT NULL,
  `total` INT NOT NULL DEFAULT -1,
  `perUserLimit` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Coupon_validFrom_idx` (`validFrom`),
  INDEX `Coupon_validTo_idx` (`validTo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserCoupon` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `couponId` INT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'unused',
  `orderId` INT NULL,
  `claimedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `usedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `UserCoupon_userId_status_idx` (`userId`, `status`),
  INDEX `UserCoupon_couponId_idx` (`couponId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Order` ADD COLUMN `discountAmount` INT NOT NULL DEFAULT 0;
ALTER TABLE `Order` ADD COLUMN `userCouponId` INT NULL;
