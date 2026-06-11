import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/edc',
});

// --- Mock In-Memory Database State ---
let sites = [
  { id: 1, name: 'Berlin Charité Medical Center', location: 'Germany', created_at: new Date() },
  { id: 2, name: 'New York Presbyterian Hospital', location: 'USA', created_at: new Date() }
];

let users = [
  { id: 'mock-admin', email: 'admin@trial.com', name: 'System Admin', role: 'ADMIN', site_id: null },
  { id: 'mock-crc-1', email: 'crc1@site1.org', name: 'John CRC Site 1', role: 'DATA_ENTRY', site_id: 1 },
  { id: 'mock-crc-2', email: 'crc2@site2.org', name: 'Jane CRC Site 2', role: 'DATA_ENTRY', site_id: 2 },
  { id: 'mock-cra', email: 'cra@sponsor.com', name: 'Alice CRA Monitor', role: 'MONITOR', site_id: null },
  { id: 'mock-patient-1', email: 'patient1@home.com', name: 'Robert Patient 1', role: 'PATIENT', site_id: 1 }
];

let patients: any[] = [];
let clinicalForms: any[] = [];
let auditLogs: any[] = [];

let useMemoryDb = false;

// Mock Query Solver
const mockQuery = async (text: string, params: any[] = []) => {
  const query = text.trim().replace(/\s+/g, ' ');

  // SELECT * FROM sites
  if (query.startsWith('SELECT * FROM sites')) {
    return { rows: sites };
  }

  // INSERT INTO sites
  if (query.startsWith('INSERT INTO sites')) {
    const newSite = {
      id: sites.length + 1,
      name: params[0],
      location: params[1],
      created_at: new Date()
    };
    sites.push(newSite);
    return { rows: [newSite] };
  }

  // INSERT INTO users ... ON CONFLICT
  if (query.startsWith('INSERT INTO users')) {
    const existingIndex = users.findIndex(u => u.id === params[0]);
    const user = {
      id: params[0],
      email: params[1],
      name: params[2],
      role: params[3],
      site_id: params[4]
    };
    if (existingIndex > -1) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    return { rows: [user] };
  }

  // SELECT p.* FROM patients
  if (query.startsWith('SELECT p.*, s.name as site_name FROM patients')) {
    let filtered = patients;
    if (query.includes('p.site_id = $1')) {
      filtered = patients.filter(p => p.site_id === params[0]);
    } else if (query.includes('p.id = $1')) {
      filtered = patients.filter(p => p.id === params[0]);
    }
    const rows = filtered.map(p => {
      const site = sites.find(s => s.id === p.site_id);
      return { ...p, site_name: site ? site.name : 'Unknown' };
    });
    return { rows };
  }

  // INSERT INTO patients
  if (query.startsWith('INSERT INTO patients')) {
    const newPatient = {
      id: patients.length + 1,
      site_id: params[0],
      initials: params[1],
      birth_date: params[2],
      gender: params[3],
      status: 'SCREENING',
      consent_signed: false,
      consent_date: null,
      consent_signature_hash: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    patients.push(newPatient);
    return { rows: [newPatient] };
  }

  // UPDATE patients (Consent Signing)
  if (query.startsWith('UPDATE patients')) {
    const pId = params[1];
    const index = patients.findIndex(p => p.id === pId);
    if (index > -1) {
      patients[index].consent_signed = true;
      patients[index].consent_date = new Date();
      patients[index].consent_signature_hash = params[0];
      patients[index].status = 'ENROLLED';
      patients[index].updated_at = new Date();
      return { rows: [patients[index]] };
    }
    return { rows: [] };
  }

  // SELECT f.* FROM clinical_forms
  if (query.startsWith('SELECT f.*, u.name as entered_by_name FROM clinical_forms')) {
    const pId = params[0];
    const filtered = clinicalForms.filter(f => f.patient_id === pId);
    const rows = filtered.map(f => {
      const u = users.find(user => user.id === f.entered_by_id);
      return { ...f, entered_by_name: u ? u.name : 'System User' };
    });
    return { rows };
  }

  // INSERT INTO clinical_forms
  if (query.startsWith('INSERT INTO clinical_forms')) {
    const newForm = {
      id: clinicalForms.length + 1,
      patient_id: params[0],
      form_type: params[1],
      entered_by_id: params[2],
      data: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
      is_frozen: false,
      frozen_by_id: null,
      frozen_at: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    clinicalForms.push(newForm);
    return { rows: [newForm] };
  }

  // UPDATE clinical_forms
  if (query.startsWith('UPDATE clinical_forms')) {
    const formId = params[1];
    const index = clinicalForms.findIndex(f => f.id === formId);
    if (index > -1) {
      if (query.includes('is_frozen = TRUE')) {
        clinicalForms[index].is_frozen = true;
        clinicalForms[index].frozen_by_id = params[0];
        clinicalForms[index].frozen_at = new Date();
      } else {
        clinicalForms[index].data = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
      }
      clinicalForms[index].updated_at = new Date();
      return { rows: [clinicalForms[index]] };
    }
    return { rows: [] };
  }

  // SELECT * FROM audit_logs
  if (query.startsWith('SELECT * FROM audit_logs')) {
    return { rows: [...auditLogs].reverse() };
  }

  // INSERT INTO audit_logs
  if (query.startsWith('INSERT INTO audit_logs')) {
    const newLog = {
      id: auditLogs.length + 1,
      user_id: params[0],
      user_email: params[1],
      user_name: params[2],
      action: params[3],
      entity_type: params[4],
      entity_id: params[5],
      old_value: params[6] ? JSON.parse(params[6]) : null,
      new_value: params[7] ? JSON.parse(params[7]) : null,
      ip_address: params[8],
      user_agent: params[9],
      timestamp: new Date()
    };
    auditLogs.push(newLog);
    return { rows: [newLog] };
  }

  // Export CDISC dataset query
  if (query.includes('FROM patients p JOIN sites s') && query.includes('clinical_forms f')) {
    const rows = patients.map(p => {
      const site = sites.find(s => s.id === p.site_id);
      const form = clinicalForms.find(f => f.patient_id === p.id) || null;
      return {
        patient_id: p.id,
        initials: p.initials,
        birth_date: p.birth_date,
        gender: p.gender,
        status: p.status,
        site_name: site ? site.name : 'Unknown',
        form_type: form ? form.form_type : null,
        form_data: form ? form.data : null,
        is_frozen: form ? form.is_frozen : null
      };
    });
    return { rows };
  }

  return { rows: [] };
};

export const initDb = async () => {
  if (useMemoryDb) {
    console.log('[DATABASE] Initialized IN-MEMORY mock engine.');
    return;
  }

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('[DATABASE] PostgreSQL schema initialized successfully.');
  } catch (err) {
    console.warn('[DATABASE] PostgreSQL failed to execute schema.sql. Falling back to IN-MEMORY database.');
    useMemoryDb = true;
    pool.query = mockQuery as any;
  }
};

// Check DB connectivity on import
pool.connect((err, client, release) => {
  if (err) {
    console.warn('[DATABASE] Warning: Could not connect to PostgreSQL server. Initializing IN-MEMORY database mode.');
    useMemoryDb = true;
    pool.query = mockQuery as any;
  } else {
    console.log('[DATABASE] Connected to PostgreSQL server.');
    if (release) release();
  }
});

export default pool;
