-- Worker Management System Database Schema (Final Complete)
CREATE DATABASE IF NOT EXISTS workermanage;
USE workermanage;

SET FOREIGN_KEY_CHECKS = 0;

-- Production Lines
CREATE TABLE IF NOT EXISTS `lines` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products (Models and Targets)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sap_code VARCHAR(100) UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    base_target INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Machines (belong to a line)
CREATE TABLE IF NOT EXISTS machines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    line_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    position INT NOT NULL DEFAULT 1,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (line_id) REFERENCES `lines`(id) ON DELETE CASCADE
);

-- Workers
CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    employee_id VARCHAR(50) UNIQUE,
    rating TINYINT DEFAULT 2,
    skill_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
    gender VARCHAR(20),
    contractor_name VARCHAR(150),
    dob DATE,
    joining_date DATE,
    father_husband_name VARCHAR(150),
    division VARCHAR(100),
    section VARCHAR(100),
    nature_of_work VARCHAR(150),
    last_attendance DATE,
    aadhaar_no VARCHAR(20),
    pf_no VARCHAR(50),
    esi_no VARCHAR(50),
    emergency_contact VARCHAR(100),
    state VARCHAR(100),
    district VARCHAR(100),
    qualification VARCHAR(150),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Daily Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    date DATE NOT NULL,
    check_in_time TIME,
    status ENUM('present', 'absent', 'late') DEFAULT 'present',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (worker_id, date),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

-- Production Logs
CREATE TABLE IF NOT EXISTS production_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    machine_id INT,
    date DATE NOT NULL,
    shift ENUM('day', 'night') DEFAULT 'day',
    target_units INT NOT NULL DEFAULT 0,
    actual_units INT NOT NULL DEFAULT 0,
    defective_count INT DEFAULT 0,
    machine_fault_flag TINYINT(1) DEFAULT 0,
    role ENUM('OPERATOR', 'HELPER', 'SUPERVISOR', 'OTHER') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL
);

-- Manager Ratings
CREATE TABLE IF NOT EXISTS manager_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 4),
    comments TEXT,
    rated_by VARCHAR(150),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

-- Efficiency Scores
CREATE TABLE IF NOT EXISTS efficiency_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    date DATE NOT NULL,
    production_score DECIMAL(5,2) DEFAULT 0,
    rating_score DECIMAL(5,2) DEFAULT 0,
    total_score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_efficiency (worker_id, date),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

-- Daily Assignments
CREATE TABLE IF NOT EXISTS daily_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    machine_id INT NOT NULL,
    line_id INT NOT NULL,
    product_id INT NULL,
    date DATE NOT NULL,
    shift ENUM('day', 'night') DEFAULT 'day',
    is_manual TINYINT(1) DEFAULT 0,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_assignment_worker (worker_id, date, shift),
    UNIQUE KEY unique_assignment_machine (machine_id, date, shift),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (line_id) REFERENCES `lines`(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

SET FOREIGN_KEY_CHECKS = 1;

-- Insert sample data
INSERT INTO `lines` (name, description) VALUES
('Line A', 'Main production line - Assembly'),
('Line B', 'Secondary production line - Packaging'),
('Line C', 'Quality control line');

INSERT INTO machines (line_id, name, position) VALUES
(1, 'A-M1', 1), (1, 'A-M2', 2), (1, 'A-M3', 3), (1, 'A-M4', 4), (1, 'A-M5', 5),
(1, 'A-M6', 6), (1, 'A-M7', 7), (1, 'A-M8', 8), (1, 'A-M9', 9), (1, 'A-M10', 10),
(2, 'B-M1', 1), (2, 'B-M2', 2), (2, 'B-M3', 3), (2, 'B-M4', 4), (2, 'B-M5', 5),
(2, 'B-M6', 6), (2, 'B-M7', 7), (2, 'B-M8', 8), (2, 'B-M9', 9), (2, 'B-M10', 10);
