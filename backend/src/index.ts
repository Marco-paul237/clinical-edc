import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/db';
import sitesRouter from './routes/sites';
import patientsRouter from './routes/patients';
import formsRouter from './routes/forms';
import auditRouter from './routes/audit';

import path from 'path';

// Load environment variables from CWD, backend directory, or parent workspace root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // Allow frontend connection
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON request bodies
app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', useMockIam: process.env.USE_MOCK_IAM === 'true' });
});

// Register API Routes
app.use('/api/sites', sitesRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/forms', formsRouter);
app.use('/api/audit', auditRouter);

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

startServer();
