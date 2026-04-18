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

CREATE TABLE patients (
    patient_id VARCHAR(36) NOT NULL,
    name  VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    location VARCHAR(150) NOT NULL,
    condition_desc VARCHAR(255) NOT NULL,
    urgency ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    consult_type ENUM('in-person', 'telemedicine') NOT NULL,
    specialization_needed VARCHAR(100) NOT NULL,
    status ENUM('pending', 'allocated', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (patient_id)
);

CREATE TABLE doctors (
    doctor_id VARCHAR(36) NOT NULL,
    user_id   INT  DEFAULT NULL,       
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    location VARCHAR(150) NOT NULL,
    experience_years INT NOT NULL,
    telemedicine_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    gender ENUM('male', 'female', 'other') NOT NULL,
    status  ENUM('available', 'busy', 'inactive') NOT NULL DEFAULT 'available',
    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (doctor_id),

    CONSTRAINT fk_doctor_user
	FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
); 

CREATE TABLE transport_services (
    transport_id VARCHAR(36) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    location VARCHAR(150) NOT NULL,
    eta_minutes INT NOT NULL,
    status  ENUM('available', 'en-route', 'unavailable') NOT NULL DEFAULT 'available',

    PRIMARY KEY (transport_id)
);

CREATE TABLE allocations (
    allocation_id  VARCHAR(36)  NOT NULL,
    patient_id     VARCHAR(36)  NOT NULL,
    doctor_id      VARCHAR(36)  NOT NULL,
    transport_id   VARCHAR(36)  DEFAULT NULL,   -- NULL for telemedicine
    urgency        VARCHAR(20)  NOT NULL,
    consult_type   VARCHAR(20)  NOT NULL,
    confirmed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (allocation_id),

    CONSTRAINT fk_alloc_patient
        FOREIGN KEY (patient_id)   REFERENCES patients (patient_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_alloc_doctor
        FOREIGN KEY (doctor_id)    REFERENCES doctors (doctor_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_alloc_transport
	FOREIGN KEY (transport_id) REFERENCES transport_services (transport_id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE equipment (
    equipment_id       VARCHAR(36)   NOT NULL,
    name               VARCHAR(100)  NOT NULL,
    category           ENUM('diagnostic', 'surgical', 'monitoring',
                            'life-support', 'other') NOT NULL,
    facility_name      VARCHAR(150)  NOT NULL,
    facility_location  VARCHAR(150)  NOT NULL,
    serial_number      VARCHAR(100)  NOT NULL,
    status             ENUM('active', 'under-maintenance', 'decommissioned')
                                     NOT NULL DEFAULT 'active',
    purchase_date      DATE          NOT NULL,
    updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (equipment_id),
    UNIQUE KEY uq_serial_number (serial_number)
);

CREATE TABLE transfer_requests (
    transfer_id   INT           NOT NULL AUTO_INCREMENT,
    equipment_id  VARCHAR(36)   NOT NULL,
    from_facility VARCHAR(150)  NOT NULL,
    to_facility   VARCHAR(150)  NOT NULL,
    reason        TEXT          NOT NULL,
    urgency       ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    date_needed   DATE          NOT NULL,
    requested_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (transfer_id),

    CONSTRAINT fk_transfer_equipment
        FOREIGN KEY (equipment_id) REFERENCES equipment (equipment_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE telemedicine_slots (
    slot_id      VARCHAR(36)  NOT NULL,
    doctor_id    VARCHAR(36)  NOT NULL,
    patient_id   VARCHAR(36)  DEFAULT NULL,    -- NULL until booked
    slot_date    DATE         NOT NULL,
    slot_time    TIME         NOT NULL,
    max_patients INT          NOT NULL DEFAULT 1,
    status       ENUM('open', 'booked', 'completed', 'cancelled')
                              NOT NULL DEFAULT 'open',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (slot_id),

    UNIQUE KEY uq_doctor_slot (doctor_id, slot_date, slot_time),

    CONSTRAINT fk_slot_doctor
        FOREIGN KEY (doctor_id)  REFERENCES doctors (patient_id)    -- ← doctors
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_slot_patient
        FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

