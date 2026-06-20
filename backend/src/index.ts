import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from CWD, backend directory, or parent workspace root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { initDb } from './db/db';
import sitesRouter from './routes/sites';
import patientsRouter from './routes/patients';
import formsRouter from './routes/forms';
import auditRouter from './routes/audit';
import queriesRouter from './routes/queries';
import imagingRouter from './routes/imaging';
import fhirRouter from './routes/fhir';
import edgeRouter from './routes/edge';
import authRouter from './routes/auth';
import { eventBroker } from './eventBroker';
import pool from './db/db';

const app = express();
const port = process.env.PORT || 5001;

// Enable CORS
app.use(cors({
  origin: '*', // Allow frontend connection
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON request bodies (with increased limit for file uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', useMockIam: process.env.USE_MOCK_IAM === 'true' });
});

// Register API Routes
app.use('/api/sites', sitesRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/forms', formsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/queries', queriesRouter);
app.use('/api/imaging', imagingRouter);
app.use('/api/fhir', fhirRouter);
app.use('/api/edge', edgeRouter);
app.use('/api/auth', authRouter);

// Real-Time Safety Alert consumer simulation
eventBroker.on('severe_adverse_event', async ({ form }) => {
  console.log(`[EVENT BROKER] Consumer received severe adverse event alert for patient PT-${form.patient_id}`);
  
  const alertMessage = `CRITICAL SAFETY ALERT: Severe adverse event logged: "${form.data.event_name}". Action required immediately.`;
  const sentTo = 'safety-monitor@sponsor.com';

  try {
    await pool.query(
      `INSERT INTO safety_alerts (form_id, severity, alert_message, sent_to, status) 
       VALUES ($1, $2, $3, $4, 'DISPATCHED')`,
      [form.id, 'Severe', alertMessage, sentTo]
    );
    console.log('[EVENT BROKER] Automated notification dispatched to safety monitoring team.');
  } catch (err) {
    console.error('[EVENT BROKER] Failed to write safety alert', err);
  }
});

// Database initialization & Server boot
const startServer = async () => {
  try {
    console.log('Initializing database connection...');
    await initDb();
    
    app.listen(port, () => {
      console.log(`[SERVER] Running on http://localhost:${port}`);
      console.log(`[SERVER] Mock IAM Mode: ${process.env.USE_MOCK_IAM === 'true' ? 'ENABLED' : 'DISABLED'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer(); // Force nodemon restart to run updated schema.sql containing sequence resets.
