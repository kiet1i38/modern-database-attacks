CREATE DATABASE IF NOT EXISTS campus_sql_unsafe_lab CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'campus_lab'@'%' IDENTIFIED BY 'campus-lab-local-demo-only';
ALTER USER 'campus_lab'@'%' IDENTIFIED BY 'campus-lab-local-demo-only';
GRANT ALL ON campus_sql_unsafe_lab.* TO 'campus_lab'@'%';
