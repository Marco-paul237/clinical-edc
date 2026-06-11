-- Create schema for EDC clinical trials portal

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
  form_type VARCHAR(50) NOT NULL CHECK (form_type IN ('VITALS', 'LABS', 'ADVERSE_EVENTS')),
  entered_by_id VARCHAR(255) REFERENCES users(id),
  data JSONB NOT NULL,
  is_frozen BOOLEAN DEFAULT FALSE,
  frozen_by_id VARCHAR(255) REFERENCES users(id),
  frozen_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Seed study sites
INSERT INTO sites (id, name, location) VALUES 
(1, 'Berlin Charité Medical Center', 'Germany')
ON CONFLICT DO NOTHING;

INSERT INTO sites (id, name, location) VALUES 
(2, 'New York Presbyterian Hospital', 'USA')
ON CONFLICT DO NOTHING;

-- Seed mock users to correspond to the mock auth developer mode
INSERT INTO users (id, email, name, role, site_id) VALUES
('mock-admin', 'admin@trial.com', 'System Admin', 'ADMIN', NULL),
('mock-crc-1', 'crc1@site1.org', 'John CRC Site 1', 'DATA_ENTRY', 1),
('mock-crc-2', 'crc2@site2.org', 'Jane CRC Site 2', 'DATA_ENTRY', 2),
('mock-cra', 'cra@sponsor.com', 'Alice CRA Monitor', 'MONITOR', NULL),
('mock-patient-1', 'patient1@home.com', 'Robert Patient 1', 'PATIENT', 1)
ON CONFLICT DO NOTHING;
