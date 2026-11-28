-- MySQL 8 schema for the fleet, trips, and attendance contribution.
CREATE DATABASE IF NOT EXISTS sutech_transport
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sutech_transport;

CREATE TABLE IF NOT EXISTS lines (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name_en VARCHAR(100) NOT NULL,
    campus_arrival TIME NOT NULL DEFAULT '08:30:00',
    return_departure_time TIME NOT NULL DEFAULT '16:30:00'
);

CREATE TABLE IF NOT EXISTS stops (
    id VARCHAR(50) PRIMARY KEY,
    line_id VARCHAR(50) NOT NULL,
    stop_order INT NOT NULL CHECK (stop_order > 0),
    name_en VARCHAR(100) NOT NULL,
    pickup_time TIME,
    UNIQUE KEY uq_stops_line_order (line_id, stop_order),
    FOREIGN KEY (line_id) REFERENCES lines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS buses (
    id VARCHAR(50) PRIMARY KEY,
    plate VARCHAR(30) NOT NULL UNIQUE,
    bus_type ENUM('hiace', 'coaster', 'large_bus') NOT NULL,
    seats_total INT NOT NULL CHECK (seats_total > 0),
    driver_name VARCHAR(100),
    driver_phone VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(50) PRIMARY KEY,
    service_date DATE NOT NULL,
    direction ENUM('outbound', 'return') NOT NULL,
    line_id VARCHAR(50) NOT NULL,
    bus_id VARCHAR(50) NOT NULL,
    driver_name VARCHAR(100),
    driver_phone VARCHAR(30),
    status ENUM('not_started', 'in_progress', 'ended') NOT NULL DEFAULT 'not_started',
    total_delay_minutes INT NOT NULL DEFAULT 0 CHECK (total_delay_minutes >= 0),
    KEY ix_trips_service_date (service_date),
    KEY ix_trips_line_date (line_id, service_date),
    FOREIGN KEY (line_id) REFERENCES lines(id),
    FOREIGN KEY (bus_id) REFERENCES buses(id)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id VARCHAR(50) NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    stop_id VARCHAR(50),
    state ENUM('waiting', 'boarded', 'checked_out', 'not_going', 'absent') NOT NULL DEFAULT 'waiting',
    boarded_at DATETIME,
    checked_out_at DATETIME,
    checkout_reason VARCHAR(500),
    UNIQUE KEY uq_attendance_trip_student (trip_id, student_id),
    KEY ix_attendance_student (student_id),
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS replacement_logs (
    id VARCHAR(80) PRIMARY KEY,
    trip_id VARCHAR(50) NOT NULL,
    old_bus_id VARCHAR(50) NOT NULL,
    new_bus_id VARCHAR(50),
    old_driver_name VARCHAR(100),
    new_driver_name VARCHAR(100),
    reason VARCHAR(100) NOT NULL,
    note TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (old_bus_id) REFERENCES buses(id),
    FOREIGN KEY (new_bus_id) REFERENCES buses(id)
);

CREATE TABLE IF NOT EXISTS delay_logs (
    id VARCHAR(80) PRIMARY KEY,
    trip_id VARCHAR(50) NOT NULL,
    minutes INT NOT NULL CHECK (minutes > 0),
    reason VARCHAR(100) NOT NULL,
    note TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);
