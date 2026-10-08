CREATE DATABASE IF NOT EXISTS campus_sql_safe CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS campus_sql_unsafe CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'campus'@'%' IDENTIFIED BY 'campus-local-demo-only';
GRANT ALL ON campus_sql_safe.* TO 'campus'@'%';
GRANT ALL ON campus_sql_unsafe.* TO 'campus'@'%';
