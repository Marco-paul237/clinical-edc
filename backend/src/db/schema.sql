-- Create schema for EDC clinical trials portal

DROP TABLE IF EXISTS safety_alerts CASCADE;
DROP TABLE IF EXISTS imaging_scans CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS queries CASCADE;
DROP TABLE IF EXISTS clinical_forms CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS sites CASCADE;

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY, -- IAM unique user ID (Keycloak UUID or Mock ID)
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'MONITOR', 'DATA_ENTRY', 'PATIENT')),
  site_id INT REFERENCES sites(id),
  password VARCHAR(255) DEFAULT 'password',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  site_id INT REFERENCES sites(id) NOT NULL,
  initials VARCHAR(10) NOT NULL,
  birth_date DATE NOT NULL,
  gender VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'SCREENING' CHECK (status IN ('SCREENING', 'ENROLLED', 'COMPLETED', 'WITHDRAWN')),
  consent_signed BOOLEAN DEFAULT FALSE,
  consent_date TIMESTAMP,
  consent_signature_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinical_forms (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(id) NOT NULL,
  event_name VARCHAR(100) DEFAULT 'Screening' CHECK (event_name IN ('Screening', 'Baseline', 'Week 4', 'Week 12', 'Adverse Event')),
  form_type VARCHAR(50) NOT NULL CHECK (form_type IN ('VITALS', 'LABS', 'ADVERSE_EVENTS')),
  entered_by_id VARCHAR(255) REFERENCES users(id),
  data JSONB NOT NULL,
  is_frozen BOOLEAN DEFAULT FALSE,
  frozen_by_id VARCHAR(255) REFERENCES users(id),
  frozen_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queries (
  id SERIAL PRIMARY KEY,
  form_id INT REFERENCES clinical_forms(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'CLOSED')),
  description TEXT NOT NULL,
  resolution TEXT,
  created_by_id VARCHAR(255) REFERENCES users(id),
  resolved_by_id VARCHAR(255) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- LOGIN, DATA_ENTRY, DATA_UPDATE, DATA_FREEZE, EXPORT, CONSENT_SIGN
  entity_type VARCHAR(50) NOT NULL, -- PATIENT, FORM, USER, SITE, SESSION
  entity_id VARCHAR(255) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS imaging_scans (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(id) ON DELETE CASCADE,
  scan_type VARCHAR(50) NOT NULL,
  scan_date DATE NOT NULL,
  slice_count INT NOT NULL,
  metadata JSONB NOT NULL,
  raw_image_url TEXT,
  system_report TEXT,
  validated_report TEXT,
  is_validated BOOLEAN DEFAULT FALSE,
  validated_by_id VARCHAR(100),
  validated_at TIMESTAMP,
  signature_hash VARCHAR(256),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS safety_alerts (
  id SERIAL PRIMARY KEY,
  form_id INT REFERENCES clinical_forms(id) ON DELETE CASCADE,
  severity VARCHAR(50) NOT NULL,
  alert_message TEXT NOT NULL,
  sent_to VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'DISPATCHED',
  dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed study sites
INSERT INTO sites (id, name, location) VALUES 
(1, 'Berlin Charité Medical Center', 'Germany')
ON CONFLICT DO NOTHING;

INSERT INTO sites (id, name, location) VALUES 
(2, 'New York Presbyterian Hospital', 'USA')
ON CONFLICT DO NOTHING;

-- Seed mock users to correspond to the mock auth developer mode
INSERT INTO users (id, email, name, role, site_id, password) VALUES
('mock-admin', 'admin@trial.com', 'System Admin', 'ADMIN', NULL, 'password'),
('mock-crc-1', 'crc1@site1.org', 'John CRC Site 1', 'DATA_ENTRY', 1, 'password'),
('mock-crc-2', 'crc2@site2.org', 'Jane CRC Site 2', 'DATA_ENTRY', 2, 'password'),
('mock-cra', 'cra@sponsor.com', 'Alice CRA Monitor', 'MONITOR', NULL, 'password'),
('mock-patient-1', 'patient1@home.com', 'Robert Patient 1', 'PATIENT', 1, 'password')
ON CONFLICT DO NOTHING;
