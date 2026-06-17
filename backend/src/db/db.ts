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
  { id: 'mock-admin', email: 'admin@trial.com', name: 'System Admin', role: 'ADMIN', site_id: null, password: 'password' },
  { id: 'mock-crc-1', email: 'crc1@site1.org', name: 'John CRC Site 1', role: 'DATA_ENTRY', site_id: 1, password: 'password' },
  { id: 'mock-crc-2', email: 'crc2@site2.org', name: 'Jane CRC Site 2', role: 'DATA_ENTRY', site_id: 2, password: 'password' },
  { id: 'mock-cra', email: 'cra@sponsor.com', name: 'Alice CRA Monitor', role: 'MONITOR', site_id: null, password: 'password' },
  { id: 'mock-patient-1', email: 'patient1@home.com', name: 'Robert Patient 1', role: 'PATIENT', site_id: 1, password: 'password' }
];

let patients: any[] = [];
let clinicalForms: any[] = [];
let auditLogs: any[] = [];
let queriesList: any[] = [];

let imagingScans: any[] = [
  {
    id: 1,
    patient_id: 1,
    scan_type: 'MRI',
    scan_date: new Date('2026-05-10'),
    slice_count: 12,
    metadata: {
      body_part: 'BRAIN',
      manufacturer: 'Siemens Medical Systems',
      institution: 'Berlin Charité Medical Center',
      phi_patient_name: 'Robert Patient 1',
      phi_patient_id: 'PT-001',
      tumor_detected: true,
      suggested_diameter_mm: 22.4,
      suggested_volume_cc: 5.8
    },
    raw_image_url: null,
    system_report: 'Automated AI analysis: Detected a hyperintense lesion in the left temporal lobe measuring approximately 22.4mm in diameter. Estimated volume is 5.8cc. Mass effect is negligible. Differential diagnosis includes low-grade glioma or demyelinating plaque.',
    validated_report: null,
    is_validated: false,
    validated_by_id: null,
    validated_at: null,
    signature_hash: null,
    created_at: new Date()
  }
];
let safetyAlerts: any[] = [];

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

  // SELECT * FROM users
  if (query.startsWith('SELECT * FROM users') || query.includes('FROM users')) {
    let filtered = users;
    if (query.includes('email = $1')) {
      filtered = users.filter(u => u.email === params[0]);
    } else if (query.includes('id = $1')) {
      filtered = users.filter(u => u.id === params[0]);
    }
    return { rows: filtered };
  }

  // INSERT INTO users ... ON CONFLICT
  if (query.startsWith('INSERT INTO users')) {
    const existingIndex = users.findIndex(u => u.id === params[0]);
    const user = {
      id: params[0],
      email: params[1],
      name: params[2],
      role: params[3],
      site_id: params[4],
      password: params[5] || 'password'
    };
    if (existingIndex > -1) {
      users[existingIndex] = { ...users[existingIndex], ...user };
    } else {
      users.push(user);
    }
    return { rows: [user] };
  }

  // SELECT p.* FROM patients
  if (query.startsWith('SELECT p.*, s.name as site_name FROM patients')) {
    console.log('[MOCK DB] SELECT patients query:', query, 'params:', params, 'current patients:', patients);
    let filtered = patients;
    if (query.includes('p.site_id = $1')) {
      filtered = patients.filter(p => p.site_id === params[0]);
    } else if (query.includes('p.id = $1')) {
      filtered = patients.filter(p => p.id === params[0]);
    }
    console.log('[MOCK DB] filtered patients:', filtered);
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
    const hasEvent = query.includes('event_name');
    const pId = params[0];
    const eventName = hasEvent ? params[1] : 'Screening';
    const formType = hasEvent ? params[2] : params[1];
    const enteredById = hasEvent ? params[3] : params[2];
    const dataVal = hasEvent ? params[4] : params[3];

    const newForm = {
      id: clinicalForms.length + 1,
      patient_id: pId,
      event_name: eventName,
      form_type: formType,
      entered_by_id: enteredById,
      data: typeof dataVal === 'string' ? JSON.parse(dataVal) : dataVal,
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

  // SELECT * FROM queries (Discrepancy Notes)
  if (query.startsWith('SELECT * FROM queries') || query.startsWith('SELECT q.*')) {
    if (query.includes('JOIN clinical_forms f')) {
      let filtered = queriesList;
      if (query.includes('p.site_id = $1')) {
        filtered = queriesList.filter(q => {
          const form = clinicalForms.find(f => f.id === q.form_id);
          const patient = patients.find(p => p.id === (form ? form.patient_id : null));
          return patient && patient.site_id === params[0];
        });
      }
      const rows = filtered.map(q => {
        const form = clinicalForms.find(f => f.id === q.form_id) || {};
        const patient = patients.find(p => p.id === form.patient_id) || {};
        const creator = users.find(u => u.id === q.created_by_id);
        const resolver = users.find(u => u.id === q.resolved_by_id);
        return {
          ...q,
          form_type: form.form_type || 'Unknown',
          event_name: form.event_name || 'Screening',
          patient_id: patient.id || 0,
          initials: patient.initials || '??',
          site_id: patient.site_id || null,
          created_by_name: creator ? creator.name : 'System Monitor',
          resolved_by_name: resolver ? resolver.name : null
        };
      });
      return { rows };
    }

    let filtered = queriesList;
    if (query.includes('form_id = $1')) {
      filtered = queriesList.filter(q => q.form_id === params[0]);
    }
    return { rows: filtered };
  }

  // INSERT INTO queries
  if (query.startsWith('INSERT INTO queries')) {
    const newQuery = {
      id: queriesList.length + 1,
      form_id: params[0],
      field_name: params[1],
      description: params[2],
      created_by_id: params[3],
      status: 'OPEN',
      resolution: null,
      resolved_by_id: null,
      created_at: new Date(),
      resolved_at: null
    };
    queriesList.push(newQuery);
    return { rows: [newQuery] };
  }

  // UPDATE queries
  if (query.startsWith('UPDATE queries')) {
    let qId: number;
    let resolution: string | null = null;
    let status: string = 'OPEN';
    let resolvedById: string | null = null;

    if (query.includes("status = 'RESOLVED'")) {
      // SET resolution = $1, status = 'RESOLVED', resolved_by_id = $2 WHERE id = $3
      resolution = params[0];
      resolvedById = params[1];
      qId = params[2];
      status = 'RESOLVED';
    } else if (query.includes("status = 'CLOSED'")) {
      // SET status = 'CLOSED', resolved_by_id = $1 WHERE id = $2
      resolvedById = params[0];
      qId = params[1];
      status = 'CLOSED';
    } else {
      resolution = params[0];
      status = params[1];
      resolvedById = params[2];
      qId = params[3];
    }

    const index = queriesList.findIndex(q => q.id === qId);
    if (index > -1) {
      if (resolution !== null) {
        queriesList[index].resolution = resolution;
      }
      queriesList[index].status = status;
      queriesList[index].resolved_by_id = resolvedById;
      queriesList[index].resolved_at = new Date();
      return { rows: [queriesList[index]] };
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

  // INSERT INTO imaging_scans
  if (query.startsWith('INSERT INTO imaging_scans')) {
    const newScan = {
      id: imagingScans.length + 1,
      patient_id: params[0],
      scan_type: params[1],
      scan_date: params[2],
      slice_count: params[3],
      metadata: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
      raw_image_url: params[5] || null,
      system_report: params[6] || null,
      validated_report: params[7] || null,
      is_validated: params[8] || false,
      validated_by_id: params[9] || null,
      validated_at: params[10] || null,
      signature_hash: params[11] || null,
      created_at: new Date()
    };
    imagingScans.push(newScan);
    return { rows: [newScan] };
  }

  // UPDATE imaging_scans
  if (query.startsWith('UPDATE imaging_scans')) {
    if (query.includes('validated_report')) {
      const validated_report = params[0];
      const validated_by_id = params[1];
      const validated_at = params[2];
      const signature_hash = params[3];
      const scanId = params[4];
      const index = imagingScans.findIndex(s => s.id === scanId);
      if (index > -1) {
        imagingScans[index].validated_report = validated_report;
        imagingScans[index].is_validated = true;
        imagingScans[index].validated_by_id = validated_by_id;
        imagingScans[index].validated_at = validated_at;
        imagingScans[index].signature_hash = signature_hash;
        return { rows: [imagingScans[index]] };
      }
    }
  }

  // SELECT * FROM imaging_scans
  if (query.startsWith('SELECT * FROM imaging_scans') || query.includes('imaging_scans')) {
    if (query.includes('patient_id = $1')) {
      const pId = params[0];
      const filtered = imagingScans.filter(s => s.patient_id === pId);
      return { rows: filtered };
    }
    return { rows: imagingScans };
  }

  // INSERT INTO safety_alerts
  if (query.startsWith('INSERT INTO safety_alerts')) {
    const newAlert = {
      id: safetyAlerts.length + 1,
      form_id: params[0],
      severity: params[1],
      alert_message: params[2],
      sent_to: params[3],
      status: 'DISPATCHED',
      dispatched_at: new Date()
    };
    safetyAlerts.push(newAlert);
    return { rows: [newAlert] };
  }

  // SELECT * FROM safety_alerts
  if (query.startsWith('SELECT * FROM safety_alerts') || query.includes('safety_alerts')) {
    return { rows: safetyAlerts };
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
    console.warn('[DATABASE] PostgreSQL failed to execute schema.sql:', err);
    console.warn('Falling back to IN-MEMORY database.');
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
