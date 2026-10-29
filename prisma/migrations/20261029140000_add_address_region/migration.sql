-- 给收货地址补省/市/区字段（与前端地址表单对齐）
ALTER TABLE `Address` ADD COLUMN `province` VARCHAR(50);
ALTER TABLE `Address` ADD COLUMN `city` VARCHAR(50);
ALTER TABLE `Address` ADD COLUMN `district` VARCHAR(50);
