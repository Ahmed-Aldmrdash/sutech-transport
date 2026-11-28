USE sutech_transport;

INSERT INTO lines (id, code, name_en, campus_arrival, return_departure_time)
VALUES ('line_1', '1', '10th of Ramadan Line', '08:30:00', '16:30:00')
ON DUPLICATE KEY UPDATE
    code = VALUES(code), name_en = VALUES(name_en),
    campus_arrival = VALUES(campus_arrival),
    return_departure_time = VALUES(return_departure_time);

INSERT INTO stops (id, line_id, stop_order, name_en, pickup_time)
VALUES
    ('stop_1', 'line_1', 1, 'Stop 1', '07:15:00'),
    ('stop_2', 'line_1', 2, 'Stop 2', '07:35:00')
ON DUPLICATE KEY UPDATE
    line_id = VALUES(line_id), stop_order = VALUES(stop_order),
    name_en = VALUES(name_en), pickup_time = VALUES(pickup_time);

INSERT INTO buses (id, plate, bus_type, seats_total, driver_name, driver_phone)
VALUES
    ('bus_01', 'ABC-123', 'coaster', 24, 'Ali', '01000000001'),
    ('bus_02', 'XYZ-789', 'hiace', 14, 'Karim', '01000000002')
ON DUPLICATE KEY UPDATE
    plate = VALUES(plate), bus_type = VALUES(bus_type),
    seats_total = VALUES(seats_total), driver_name = VALUES(driver_name),
    driver_phone = VALUES(driver_phone);

INSERT INTO trips
    (id, service_date, direction, line_id, bus_id, driver_name, driver_phone, status, total_delay_minutes)
VALUES
    ('trip_01', '2026-11-20', 'outbound', 'line_1', 'bus_01', 'Ali', '01000000001', 'not_started', 0)
ON DUPLICATE KEY UPDATE
    service_date = VALUES(service_date), direction = VALUES(direction),
    line_id = VALUES(line_id), bus_id = VALUES(bus_id),
    driver_name = VALUES(driver_name), driver_phone = VALUES(driver_phone);

INSERT INTO attendance_records (trip_id, student_id, stop_id, state)
VALUES
    ('trip_01', 'std_101', 'stop_1', 'waiting'),
    ('trip_01', 'std_102', 'stop_2', 'waiting'),
    ('trip_01', 'std_103', 'stop_2', 'not_going')
ON DUPLICATE KEY UPDATE stop_id = VALUES(stop_id);
