import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Retrieve mock FHIR resources for a patient to auto-populate logs
router.get('/patient/:patientId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const patientId = parseInt(req.params.patientId, 10);

  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  try {
    // Check if patient exists
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = patientResult.rows[0];

    // Mock FHIR Bundle containing clinical resources mapped to the Patient
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 6,
      entry: [
        {
          fullUrl: `http://hospital-emr.org/fhir/Patient/fhir-pat-${patientId}`,
          resource: {
            resourceType: 'Patient',
            id: `fhir-pat-${patientId}`,
            identifier: [
              {
                use: 'official',
                system: 'http://hospital-emr.org/identifiers/patient',
                value: `EMR-PT-00${patientId}`
              }
            ],
            name: [
              {
                use: 'official',
                family: 'Patient',
                given: [patient.initials || 'Subject']
              }
            ],
            gender: patient.gender ? patient.gender.toLowerCase() : 'unknown',
            birthDate: patient.birth_date
          }
        },
        // Blood Pressure Observation
        {
          fullUrl: 'http://hospital-emr.org/fhir/Observation/obs-bp-1',
          resource: {
            resourceType: 'Observation',
            id: 'obs-bp-1',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'vital-signs',
                    display: 'Vital Signs'
                  }
                ]
              }
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '85354-9',
                  display: 'Blood pressure panel with all children'
                }
              ]
            },
            subject: {
              reference: `Patient/fhir-pat-${patientId}`
            },
            effectiveDateTime: new Date().toISOString(),
            component: [
              {
                code: {
                  coding: [
                    {
                      system: 'http://loinc.org',
                      code: '8480-6',
                      display: 'Systolic blood pressure'
                    }
                  ]
                },
                valueQuantity: {
                  value: 122,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mm[Hg]'
                }
              },
              {
                code: {
                  coding: [
                    {
                      system: 'http://loinc.org',
                      code: '8462-4',
                      display: 'Diastolic blood pressure'
                    }
                  ]
                },
                valueQuantity: {
                  value: 82,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mm[Hg]'
                }
              }
            ]
          }
        },
        // Heart Rate Observation
        {
          fullUrl: 'http://hospital-emr.org/fhir/Observation/obs-hr-1',
          resource: {
            resourceType: 'Observation',
            id: 'obs-hr-1',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'vital-signs',
                    display: 'Vital Signs'
                  }
                ]
              }
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8867-4',
                  display: 'Heart rate'
                }
              ]
            },
            subject: {
              reference: `Patient/fhir-pat-${patientId}`
            },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: {
              value: 76,
              unit: 'bpm',
              system: 'http://unitsofmeasure.org',
              code: '/min'
            }
          }
        },
        // Body Weight Observation
        {
          fullUrl: 'http://hospital-emr.org/fhir/Observation/obs-wt-1',
          resource: {
            resourceType: 'Observation',
            id: 'obs-wt-1',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'vital-signs',
                    display: 'Vital Signs'
                  }
                ]
              }
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '29463-7',
                  display: 'Body weight'
                }
              ]
            },
            subject: {
              reference: `Patient/fhir-pat-${patientId}`
            },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: {
              value: 75.3,
              unit: 'kg',
              system: 'http://unitsofmeasure.org',
              code: 'kg'
            }
          }
        },
        // White Blood Cells Observation
        {
          fullUrl: 'http://hospital-emr.org/fhir/Observation/obs-wbc-1',
          resource: {
            resourceType: 'Observation',
            id: 'obs-wbc-1',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'laboratory',
                    display: 'Laboratory'
                  }
                ]
              }
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '26464-8',
                  display: 'Leukocytes [#/volume] in Blood'
                }
              ]
            },
            subject: {
              reference: `Patient/fhir-pat-${patientId}`
            },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: {
              value: 6.8,
              unit: '10^9/L',
              system: 'http://unitsofmeasure.org',
              code: '10*9/L'
            }
          }
        },
        // Glucose Observation
        {
          fullUrl: 'http://hospital-emr.org/fhir/Observation/obs-gluc-1',
          resource: {
            resourceType: 'Observation',
            id: 'obs-gluc-1',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'laboratory',
                    display: 'Laboratory'
                  }
                ]
              }
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '2339-0',
                  display: 'Glucose [Mass/volume] in Blood'
                }
              ]
            },
            subject: {
              reference: `Patient/fhir-pat-${patientId}`
            },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: {
              value: 98,
              unit: 'mg/dL',
              system: 'http://unitsofmeasure.org',
              code: 'mg/dL'
            }
          }
        }
      ]
    };

    res.json(fhirBundle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to query hospital FHIR server' });
  }
});

export default router;
