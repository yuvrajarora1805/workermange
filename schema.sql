-- Worker Management System Database Schema
-- Run this in phpMyAdmin or MySQL CLI

CREATE DATABASE IF NOT EXISTS workermanage;
USE workermanage;

-- Production Lines
CREATE TABLE IF NOT EXISTS `lines` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
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
    skill_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
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

-- Production Logs (daily units)
CREATE TABLE IF NOT EXISTS production_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    machine_id INT,
    date DATE NOT NULL,
    target_units INT NOT NULL DEFAULT 0,
    actual_units INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL
);

-- Manager Ratings (1-4 scale)
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

-- Efficiency Scores (computed)
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

-- Daily Assignments (worker -> machine)
CREATE TABLE IF NOT EXISTS daily_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    machine_id INT NOT NULL,
    line_id INT NOT NULL,
    date DATE NOT NULL,
    is_manual TINYINT(1) DEFAULT 0,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_assignment_worker (worker_id, date),
    UNIQUE KEY unique_assignment_machine (machine_id, date),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (line_id) REFERENCES `lines`(id) ON DELETE CASCADE
);

-- Insert sample data
INSERT INTO `lines` (name, description) VALUES
('Line A', 'Main production line - Assembly'),
('Line B', 'Secondary production line - Packaging'),
('Line C', 'Quality control line');

INSERT INTO machines (line_id, name, position) VALUES
(1, 'A-M1', 1), (1, 'A-M2', 2), (1, 'A-M3', 3), (1, 'A-M4', 4), (1, 'A-M5', 5),
(1, 'A-M6', 6), (1, 'A-M7', 7), (1, 'A-M8', 8), (1, 'A-M9', 9), (1, 'A-M10', 10),
(2, 'B-M1', 1), (2, 'B-M2', 2), (2, 'B-M3', 3), (2, 'B-M4', 4), (2, 'B-M5', 5),
(2, 'B-M6', 6), (2, 'B-M7', 7), (2, 'B-M8', 8), (2, 'B-M9', 9), (2, 'B-M10', 10),
(2, 'B-M11', 11), (2, 'B-M12', 12),
(3, 'C-M1', 1), (3, 'C-M2', 2), (3, 'C-M3', 3), (3, 'C-M4', 4), (3, 'C-M5', 5),
(3, 'C-M6', 6), (3, 'C-M7', 7), (3, 'C-M8', 8), (3, 'C-M9', 9), (3, 'C-M10', 10);

INSERT INTO workers (name, phone, employee_id, skill_level) VALUES
('Rajesh Kumar', '9876543210', 'EMP001', 'expert'),
('Suresh Patel', '9876543211', 'EMP002', 'advanced'),
('Amit Singh', '9876543212', 'EMP003', 'advanced'),
('Vikram Sharma', '9876543213', 'EMP004', 'intermediate'),
('Deepak Verma', '9876543214', 'EMP005', 'intermediate'),
('Manoj Yadav', '9876543215', 'EMP006', 'expert'),
('Ramesh Gupta', '9876543216', 'EMP007', 'advanced'),
('Sanjay Tiwari', '9876543217', 'EMP008', 'intermediate'),
('Arun Mishra', '9876543218', 'EMP009', 'beginner'),
('Pradeep Joshi', '9876543219', 'EMP010', 'advanced'),
('Karan Chauhan', '9876543220', 'EMP011', 'intermediate'),
('Nitin Rawat', '9876543221', 'EMP012', 'expert'),
('Rohit Pandey', '9876543222', 'EMP013', 'advanced'),
('Sunil Negi', '9876543223', 'EMP014', 'intermediate'),
('Ajay Bisht', '9876543224', 'EMP015', 'beginner'),
('Mohit Dhiman', '9876543225', 'EMP016', 'advanced'),
('Rahul Thakur', '9876543226', 'EMP017', 'intermediate'),
('Vishal Mehta', '9876543227', 'EMP018', 'expert'),
('Gaurav Saini', '9876543228', 'EMP019', 'advanced'),
('Pawan Bhatt', '9876543229', 'EMP020', 'intermediate'),
('Sachin Dobhal', '9876543230', 'EMP021', 'advanced'),
('Naveen Pundir', '9876543231', 'EMP022', 'intermediate'),
('Yogesh Rawat', '9876543232', 'EMP023', 'beginner'),
('Dinesh Negi', '9876543233', 'EMP024', 'advanced'),
('Harish Joshi', '9876543234', 'EMP025', 'expert'),
('Mukesh Gusain', '9876543235', 'EMP026', 'intermediate'),
('Lalit Semwal', '9876543236', 'EMP027', 'advanced'),
('Rakesh Bhatt', '9876543237', 'EMP028', 'intermediate'),
('Ashok Panwar', '9876543238', 'EMP029', 'beginner'),
('Bhupendra Shah', '9876543239', 'EMP030', 'advanced'),
('Trilok Nath', '9876543240', 'EMP031', 'expert'),
('Ghanshyam Das', '9876543241', 'EMP032', 'intermediate'),
('Jagdish Prasad', '9876543242', 'EMP033', 'advanced'),
('Kamlesh Rawat', '9876543243', 'EMP034', 'intermediate'),
('Umesh Panwar', '9876543244', 'EMP035', 'advanced');
