CREATE DATABASE medilink_db;
USE medilink_db;

CREATE TABLE users (
    user_id     INT AUTO_INCREMENT PRIMARY KEY,
    first_name  VARCHAR(50)  NOT NULL,
    last_name   VARCHAR(50)  NOT NULL,
    email       VARCHAR(100) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('Healthcare Administrator','Doctor / Specialist',
                     'Field Coordinator','Data Analyst') DEFAULT 'Field Coordinator',
    district    VARCHAR(100),
    created_at  DATETIME DEFAULT NOW()
);