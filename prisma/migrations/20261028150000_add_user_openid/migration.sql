-- AlterTable
ALTER TABLE `User` ADD COLUMN `openid` VARCHAR(191),
ADD COLUMN `unionid` VARCHAR(191);

-- CreateIndex
CREATE UNIQUE INDEX `User_openid_key` ON `User`(`openid`);
