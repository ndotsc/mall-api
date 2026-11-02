-- 创建 RefreshToken 表，支撑 JWT 刷新令牌的轮换与吊销
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `replacedBy` VARCHAR(191),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `RefreshToken_userId_idx` ON `RefreshToken` (`userId`);
CREATE INDEX `RefreshToken_familyId_idx` ON `RefreshToken` (`familyId`);
