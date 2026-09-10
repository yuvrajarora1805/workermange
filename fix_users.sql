CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('supervisor','line_lead','hr','production_team','admin') NOT NULL DEFAULT 'line_lead',
  `full_name` varchar(150) DEFAULT 'Admin User',
  `is_active` tinyint(1) DEFAULT 1,
  `line_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `line_id` (`line_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `users` (`username`, `password_hash`, `role`, `full_name`, `is_active`) 
VALUES ('admin', '6c7959267996eed64117f21bddd8a36d:fa6c78522b59e17c7793f43a4afa63b8748b72dd30914bd2c3d7e1f8165d706fbd9861b32f9fa7a115ca8510105fc4443f476f7c3bcd97b7ca844b4ac65cfc2f', 'admin', 'Admin User', 1);

UPDATE `users` SET `role` = 'admin' WHERE `username` = 'admin';
