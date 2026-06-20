'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { 
  FileText, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Activity, 
  FileCheck2, 
  Heart, 
  FileWarning, 
  AlertOctagon,
  Calendar,
  User,
  ShieldCheck,
  Edit2,
  ClipboardList,
  Sliders,
  Sparkles,
  EyeOff,
  Database,
  ArrowRight,
  Plus,
  Upload
} from 'lucide-react';

export default function PatientDetailPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  // Unwrap params and searchParams using React.use()
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const patientId = parseInt(resolvedParams.id, 10);
  
  const { user, apiFetch, isOffline } = useAuth();
  const router = useRouter();

  const [patient, setPatient] = useState<any>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Consent Form Sign state
  const [consentInitials, setConsentInitials] = useState('');
  const [consentCheckbox, setConsentCheckbox] = useState(false);

  // New Form Entry state
  const [activeFormTab, setActiveFormTab] = useState<'NONE' | 'VITALS' | 'LABS' | 'ADVERSE_EVENTS'>('NONE');
  const [selectedEvent, setSelectedEvent] = useState<string>('Screening');
  const [vitals, setVitals] = useState({ heartRate: '', bloodPressure: '', weight: '' });
  const [labs, setLabs] = useState({ wbc: '', rbc: '', glucose: '' });
  const [adverseEvent, setAdverseEvent] = useState({ eventName: '', severity: 'Mild', resolutionDate: '' });

  // Edit Mode state
  const [editingFormId, setEditingFormId] = useState<number | null>(null);

  // Discrepancy queries modal state
  const [activeQueryModal, setActiveQueryModal] = useState<{ formId: number; fieldName: string; query: any | null } | null>(null);
  const [queryDescription, setQueryDescription] = useState('');
  const [queryResolution, setQueryResolution] = useState('');

  // DICOM Viewer State
  const [scans, setScans] = useState<any[]>([]);
  const [selectedScan, setSelectedScan] = useState<any>(null);
  const [currentSlice, setCurrentSlice] = useState(5);
  const [windowLevel, setWindowLevel] = useState(50); // brightness
  const [windowWidth, setWindowWidth] = useState(50); // contrast
  const [deidentified, setDeidentified] = useState(false);
  const [aiSegmented, setAiSegmented] = useState(false);
  const [segmenting, setSegmenting] = useState(false);
  const [phiData, setPhiData] = useState({ name: '', id: '' });

  // Custom uploaded image file state
  const [imageFileBase64, setImageFileBase64] = useState<string | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageFileBase64(reader.result as string);
      };
      reader.onerror = (error) => {
        console.error('File reading error:', error);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFileBase64(null);
    }
  };

  // X-Ray Reporting & Validation State
  const [validationReportText, setValidationReportText] = useState('');
  const [validationInitials, setValidationInitials] = useState('');
  const [validationCheckbox, setValidationCheckbox] = useState(false);
  const [validatingScan, setValidatingScan] = useState(false);

  useEffect(() => {
    if (selectedScan) {
      setValidationReportText(selectedScan.validated_report || selectedScan.system_report || '');
      setValidationInitials('');
      setValidationCheckbox(false);
    } else {
      setValidationReportText('');
      setValidationInitials('');
      setValidationCheckbox(false);
    }
  }, [selectedScan]);

  // FHIR Importer State
  const [showFhirImporter, setShowFhirImporter] = useState(false);
  const [fhirBundle, setFhirBundle] = useState<any>(null);
  const [loadingFhir, setLoadingFhir] = useState(false);

  // Import Scan Modal State
  const [showImportScanModal, setShowImportScanModal] = useState(false);
  const [importScanType, setImportScanType] = useState('MRI');
  const [importScanDate, setImportScanDate] = useState(new Date().toISOString().slice(0, 10));
  const [importSliceCount, setImportSliceCount] = useState(12);
  const [importBodyPart, setImportBodyPart] = useState('BRAIN');
  const [importManufacturer, setImportManufacturer] = useState('Siemens Medical Systems');
  const [importInstitution, setImportInstitution] = useState('');
  const [importPatientName, setImportPatientName] = useState('');
  const [importPatientId, setImportPatientId] = useState('');
  const [importTumorDetected, setImportTumorDetected] = useState(true);
  const [importVolumeCc, setImportVolumeCc] = useState(5.8);
  const [importDiameterMm, setImportDiameterMm] = useState(22.4);
  const [importingScan, setImportingScan] = useState(false);

  useEffect(() => {
    if (patient) {
      setImportPatientName(`Subject ${patient.initials}`);
      setImportPatientId(`PT-${String(patient.id).padStart(3, '0')}`);
      setImportInstitution(patient.site_id === 1 ? 'Berlin Charité Medical Center' : 'New York Presbyterian Hospital');
    }
  }, [patient]);

  useEffect(() => {
    if (importScanType === 'Radiography (X-Ray)') {
      setImportBodyPart('CHEST');
      setImportSliceCount(1);
      setImportManufacturer('GE Healthcare');
    } else if (importScanType === 'CT') {
      setImportBodyPart('ABDOMEN');
      setImportSliceCount(12);
      setImportManufacturer('Siemens Medical Systems');
    } else {
      setImportBodyPart('BRAIN');
      setImportSliceCount(12);
      setImportManufacturer('Siemens Medical Systems');
    }
  }, [importScanType]);

  const loadPatientData = async (preferredScanId?: number) => {
    try {
      setLoading(true);
      
      // Load all patient data in parallel to optimize latency
      const [patientData, formsData, queriesData, scansData] = await Promise.all([
        apiFetch(`/api/patients/${patientId}`),
        apiFetch(`/api/forms/patient/${patientId}`),
        apiFetch('/api/queries').catch(err => {
          console.error('Failed to load discrepancy queries', err);
          return [];
        }),
        apiFetch(`/api/imaging/patient/${patientId}`).catch(err => {
          console.error('Failed to fetch patient scans', err);
          return [];
        })
      ]);

      setPatient(patientData);
      setForms(formsData);
      
      const filteredQueries = queriesData.filter((q: any) => q.patient_id === patientId);
      setQueries(filteredQueries);

      setScans(scansData);
      if (scansData.length > 0) {
        const activeScan = preferredScanId 
          ? (scansData.find((s: any) => s.id === preferredScanId) || scansData[0])
          : scansData[0];
        setSelectedScan(activeScan);
        setPhiData({
          name: activeScan.metadata?.phi_patient_name || `Subject ${patientData.initials}`,
          id: activeScan.metadata?.phi_patient_id || `PT-${String(patientData.id).padStart(3, '0')}`
        });
        setCurrentSlice(Math.floor(activeScan.slice_count / 2));
      } else {
        setSelectedScan(null);
      }

      setLoading(false);
    } catch (err: any) {
      console.warn('Patient loading warning:', err.message || err);
      setError(err.message || 'Failed to load patient records');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPatientData();
    }
  }, [user]);

  useEffect(() => {
    if (resolvedSearchParams.event) {
      setSelectedEvent(resolvedSearchParams.event);
    }
  }, [resolvedSearchParams.event]);

  // DICOM canvas MRI rendering logic
  useEffect(() => {
    if (!selectedScan) return;
    const canvas = document.getElementById('dicom-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply brightness (windowLevel) and contrast (windowWidth) filters
    const brightness = (windowLevel - 50) * 2;
    const contrast = 100 + (windowWidth - 50) * 3;
    ctx.filter = `brightness(${100 + brightness}%) contrast(${contrast}%)`;

    // Draw dark background
    ctx.fillStyle = '#060814';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (selectedScan.raw_image_url) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        if (aiSegmented) {
          ctx.filter = 'none'; // reset filter for overlays
          
          const scanTypeLower = (selectedScan.scan_type || '').toLowerCase();
          const isRadiography = scanTypeLower.includes('radiography') || scanTypeLower.includes('x-ray') || scanTypeLower.includes('xray');
          const isCT = scanTypeLower.includes('ct');
          
          let tx = 90, ty = 100, tr = 15;
          let label = 'AI: TUMOR SEGM';
          
          if (isRadiography) {
            tx = 160; ty = 110; tr = 12;
            label = 'AI: LUNG NODULE';
          } else if (isCT) {
            tx = 85; ty = 105; tr = 14;
            label = 'AI: LIVER METAS';
          }
          
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.strokeStyle = 'var(--color-error)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tx, ty, tr, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx - tr - 4, ty - tr - 4, (tr + 4) * 2, (tr + 4) * 2);
          
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(label, tx - tr - 4, ty - tr - 8);
        }
      };
      img.src = selectedScan.raw_image_url;
      return;
    }

    const scanTypeLower = (selectedScan.scan_type || '').toLowerCase();
    const isRadiography = scanTypeLower.includes('radiography') || scanTypeLower.includes('x-ray') || scanTypeLower.includes('xray');
    const isCT = scanTypeLower.includes('ct');

    if (isRadiography) {
      // Draw Radiography / X-Ray (Chest Cavity)
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Spine/Backbone (Vertical column of rectangles)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(120, 20, 10, 210);
      
      // Lungs (Two dark translucent lobes)
      ctx.fillStyle = 'rgba(10, 15, 30, 0.9)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(85, 120, 30, 75, 0.05, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(165, 120, 30, 75, -0.05, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Ribs (Horizontal curving lines crossing lungs)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 7; i++) {
        const y = 60 + i * 20;
        // Left ribs
        ctx.beginPath();
        ctx.arc(60, y, 45, 1.75 * Math.PI, 0.25 * Math.PI);
        ctx.stroke();
        
        // Right ribs
        ctx.beginPath();
        ctx.arc(190, y, 45, 0.75 * Math.PI, 1.25 * Math.PI);
        ctx.stroke();
      }
      
      // Heart silhouette (lower middle overlapping spine/right lung)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.ellipse(135, 150, 25, 35, 0.2, 0, 2 * Math.PI);
      ctx.fill();
      
      // Clavicles (collar bones at top)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(50, 45);
      ctx.quadraticCurveTo(85, 50, 120, 60);
      ctx.moveTo(200, 45);
      ctx.quadraticCurveTo(165, 50, 130, 60);
      ctx.stroke();

      if (aiSegmented) {
        ctx.filter = 'none'; // reset adjustments for colored overlays
        
        // Nodule on Right Lung
        const tx = 160;
        const ty = 110;
        const tr = 12;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.strokeStyle = 'var(--color-error)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Bounding Box
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx - tr - 4, ty - tr - 4, (tr + 4) * 2, (tr + 4) * 2);

        // Metadata Tag
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('AI: LUNG NODULE', tx - tr - 4, ty - tr - 8);
      }
    } else if (isCT) {
      // Draw Abdominal CT cross-section
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Abdominal wall
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(125, 125, 90, 75, 0, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Spine at bottom
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.rect(115, 165, 20, 20);
      ctx.fill();
      
      // Liver (Large gray wedge-shaped organ on the left side)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(55, 120);
      ctx.quadraticCurveTo(80, 80, 130, 85);
      ctx.quadraticCurveTo(115, 150, 55, 120);
      ctx.fill();
      
      // Stomach (Translucent circle on the right side)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
      ctx.beginPath();
      ctx.ellipse(175, 115, 20, 30, 0.2, 0, 2 * Math.PI);
      ctx.fill();

      if (aiSegmented) {
        ctx.filter = 'none';
        
        // Liver Lesion
        const tx = 85;
        const ty = 105;
        const tr = 14 + (currentSlice % 2);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.strokeStyle = 'var(--color-error)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Bounding Box
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx - tr - 4, ty - tr - 4, (tr + 4) * 2, (tr + 4) * 2);

        // Metadata Tag
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('AI: LIVER METAS', tx - tr - 4, ty - tr - 8);
      }
    } else {
      // Draw Brain MRI (Original Brain Skull drawing)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(125, 125, 80, 95, 0, 0, 2 * Math.PI);
      ctx.stroke();
      
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(115, 120);
      ctx.bezierCurveTo(90 + currentSlice, 100, 110, 110, 125, 120);
      ctx.bezierCurveTo(140, 110, 160 - currentSlice, 100, 135, 120);
      ctx.bezierCurveTo(145, 140, 130, 130, 125, 140);
      ctx.bezierCurveTo(120, 130, 105, 140, 115, 120);
      ctx.stroke();
      
      ctx.strokeStyle = '#1a202c';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(125, 125, 60 - i * 9, 0.15 * Math.PI + (currentSlice * 0.05), 1.85 * Math.PI - (currentSlice * 0.05));
        ctx.stroke();
      }

      if (aiSegmented) {
        ctx.filter = 'none'; // reset adjustments for colored overlays
        
        // Brain Lesion (Left Lobe)
        const tx = 90;
        const ty = 100;
        const tr = 15 + (currentSlice % 3);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.strokeStyle = 'var(--color-error)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Bounding Box
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx - tr - 4, ty - tr - 4, (tr + 4) * 2, (tr + 4) * 2);

        // Metadata Tag
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('AI: TUMOR SEGM', tx - tr - 4, ty - tr - 8);
      }
    }
  }, [selectedScan, currentSlice, windowLevel, windowWidth, aiSegmented]);

  // Handle Informed Consent Signing (FDA 21 CFR Part 11 Compliant Signature Hash)
  const handleSignConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentInitials || !consentCheckbox) {
      alert('You must provide your initials and agree to the consent conditions.');
      return;
    }

    if (consentInitials !== patient.initials) {
      alert(`Signature mismatch. Initials must match patient initials (${patient.initials}).`);
      return;
    }

    // Generate a secure mock SHA-256 signature hash of the signee credentials + date
    const signeeString = `${patient.id}-${consentInitials}-${new Date().toISOString()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signeeString);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signatureHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    try {
      const updatedPatient = await apiFetch(`/api/patients/${patientId}/consent`, {
        method: 'POST',
        body: JSON.stringify({ signatureHash })
      });
      setPatient(updatedPatient);
      alert('Informed Consent signed successfully. Study Case Report Form is now active.');
      loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to sign consent.');
    }
  };

  const handleDeidentify = async () => {
    if (!selectedScan) return;
    try {
      const res = await apiFetch('/api/imaging/deidentify', {
        method: 'POST',
        body: JSON.stringify({ scan_id: selectedScan.id })
      });
      
      setPhiData({
        name: 'ANONYMIZED',
        id: 'ANONYMIZED'
      });
      setDeidentified(true);
      
      // Update local state
      setSelectedScan((prev: any) => ({
        ...prev,
        metadata: res.deidentified
      }));
      setScans((prevScans: any[]) => prevScans.map((s) => s.id === selectedScan.id ? { ...s, metadata: res.deidentified } : s));
      
      alert('PHI Metadata headers stripped successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Failed to de-identify scan.');
    }
  };

  const handleAiSegment = async () => {
    if (!selectedScan) return;
    setSegmenting(true);
    try {
      const res = await apiFetch('/api/imaging/ai-segment', {
        method: 'POST',
        body: JSON.stringify({ scan_id: selectedScan.id })
      });
      setAiSegmented(true);
      setSegmenting(false);
      alert(`AI Interpretation Pipeline Complete!\n- Body Part: ${res.body_part}\n- Lesion Volume: ${res.lesion_volume_cc} cc\n- Max Diameter: ${res.lesion_max_diameter_mm} mm\n- Confidence: ${(res.ai_confidence * 100).toFixed(1)}%`);
    } catch (err: any) {
      console.error(err);
      setSegmenting(false);
      alert('AI interpretation pipeline failed.');
    }
  };

  const handleImportScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportingScan(true);
    try {
      const metadata = {
        body_part: importBodyPart,
        manufacturer: importManufacturer,
        institution: importInstitution,
        phi_patient_name: importPatientName,
        phi_patient_id: importPatientId,
        tumor_detected: importTumorDetected,
        suggested_volume_cc: importVolumeCc,
        suggested_max_diameter_mm: importDiameterMm
      };

      const newScan = await apiFetch('/api/imaging/upload', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId,
          scan_type: importScanType,
          scan_date: importScanDate,
          slice_count: importSliceCount,
          metadata,
          raw_image_url: imageFileBase64
        })
      });

      alert('Medical imaging scan imported successfully!');
      setShowImportScanModal(false);
      setImageFileBase64(null); // Clear image upload state
      await loadPatientData(newScan.id);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to import scan.');
    } finally {
      setImportingScan(false);
    }
  };

  const handleValidateScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScan) return;
    if (!validationInitials || !validationCheckbox) {
      alert('You must provide your digital initials and authorize the signature.');
      return;
    }

    setValidatingScan(true);
    try {
      const timestamp = new Date().toISOString();
      const rawString = `${selectedScan.id}-${validationReportText}-${validationInitials}-${user?.id || 'unknown'}-${timestamp}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(rawString);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signatureHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      await apiFetch(`/api/imaging/${selectedScan.id}/validate`, {
        method: 'POST',
        body: JSON.stringify({
          validated_report: validationReportText,
          signature_hash: signatureHash
        })
      });

      alert('Clinical report successfully validated and sealed under FDA 21 CFR Part 11 requirements.');
      await loadPatientData(selectedScan.id);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to submit digital sign-off.');
    } finally {
      setValidatingScan(false);
    }
  };

  // FHIR import triggers
  const handleOpenFhirImporter = async () => {
    setLoadingFhir(true);
    setShowFhirImporter(true);
    try {
      const bundle = await apiFetch(`/api/fhir/patient/${patientId}`);
      setFhirBundle(bundle);
      setLoadingFhir(false);
    } catch (err: any) {
      console.error(err);
      alert('Failed to connect to hospital FHIR server.');
      setShowFhirImporter(false);
      setLoadingFhir(false);
    }
  };

  const applyFhirDataToForm = () => {
    if (!fhirBundle || !fhirBundle.entry) return;
    
    let hr = '';
    let bp = '';
    let wt = '';
    let wbc = '';
    let glucose = '';
    
    fhirBundle.entry.forEach((item: any) => {
      const resource = item.resource;
      if (resource.resourceType === 'Observation') {
        const loincCode = resource.code?.coding?.[0]?.code;
        if (loincCode === '8867-4') {
          hr = String(resource.valueQuantity?.value);
        } else if (loincCode === '85354-9') {
          const sys = resource.component?.find((c: any) => c.code?.coding?.[0]?.code === '8480-6')?.valueQuantity?.value;
          const dia = resource.component?.find((c: any) => c.code?.coding?.[0]?.code === '8462-4')?.valueQuantity?.value;
          if (sys && dia) {
            bp = `${sys}/${dia}`;
          }
        } else if (loincCode === '29463-7') {
          wt = String(resource.valueQuantity?.value);
        } else if (loincCode === '26464-8') {
          wbc = String(resource.valueQuantity?.value);
        } else if (loincCode === '2339-0') {
          glucose = String(resource.valueQuantity?.value);
        }
      }
    });

    if (activeFormTab === 'VITALS') {
      setVitals({
        heartRate: hr || vitals.heartRate || '76',
        bloodPressure: bp || vitals.bloodPressure || '122/82',
        weight: wt || vitals.weight || '75.3'
      });
      alert('Vitals imported successfully from EHR!');
    } else if (activeFormTab === 'LABS') {
      setLabs({
        wbc: wbc || labs.wbc || '6.8',
        rbc: labs.rbc || '4.5',
        glucose: glucose || labs.glucose || '98'
      });
      alert('Labs imported successfully from EHR!');
    }
    
    setShowFhirImporter(false);
  };

  // Discrepancy Note handlers
  const handleOpenQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQueryModal) return;
    try {
      await apiFetch('/api/queries', {
        method: 'POST',
        body: JSON.stringify({
          form_id: activeQueryModal.formId,
          field_name: activeQueryModal.fieldName,
          description: queryDescription
        })
      });
      alert('Discrepancy note created successfully!');
      setActiveQueryModal(null);
      setQueryDescription('');
      await loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to open query');
    }
  };

  const handleResolveQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQueryModal || !activeQueryModal.query) return;
    try {
      await apiFetch(`/api/queries/${activeQueryModal.query.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          resolution: queryResolution,
          status: 'RESOLVED'
        })
      });
      alert('Discrepancy note resolved successfully!');
      setActiveQueryModal(null);
      setQueryResolution('');
      await loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to resolve query');
    }
  };

  const handleCloseQuery = async () => {
    if (!activeQueryModal || !activeQueryModal.query) return;
    try {
      await apiFetch(`/api/queries/${activeQueryModal.query.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'CLOSED'
        })
      });
      alert('Discrepancy note closed successfully!');
      setActiveQueryModal(null);
      await loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to close query');
    }
  };

  // Submit clinical form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let formData = {};
    if (activeFormTab === 'VITALS') {
      if (!vitals.heartRate || !vitals.bloodPressure || !vitals.weight) {
        alert('All vitals fields are required.');
        return;
      }
      formData = { heart_rate: vitals.heartRate, blood_pressure: vitals.bloodPressure, weight: vitals.weight };
    } else if (activeFormTab === 'LABS') {
      if (!labs.wbc || !labs.rbc || !labs.glucose) {
        alert('All lab fields are required.');
        return;
      }
      formData = { white_blood_cells: labs.wbc, red_blood_cells: labs.rbc, glucose: labs.glucose };
    } else if (activeFormTab === 'ADVERSE_EVENTS') {
      if (!adverseEvent.eventName || !adverseEvent.severity) {
        alert('Adverse Event details are required.');
        return;
      }
      formData = { event_name: adverseEvent.eventName, severity: adverseEvent.severity, resolution_date: adverseEvent.resolutionDate };
    }

    try {
      if (editingFormId) {
        // Update existing form
        await apiFetch(`/api/forms/${editingFormId}`, {
          method: 'PUT',
          body: JSON.stringify({ data: formData })
        });
        alert('Case Report Form updated successfully. Change history written to audit trail.');
      } else {
        // Create new form
        await apiFetch(`/api/forms/patient/${patientId}`, {
          method: 'POST',
          body: JSON.stringify({ 
            form_type: activeFormTab, 
            event_name: activeFormTab === 'ADVERSE_EVENTS' ? 'Adverse Event' : selectedEvent,
            data: formData 
          })
        });
        alert('Case Report Form submitted successfully.');
      }

      // Reset state
      setEditingFormId(null);
      setActiveFormTab('NONE');
      setVitals({ heartRate: '', bloodPressure: '', weight: '' });
      setLabs({ wbc: '', rbc: '', glucose: '' });
      setAdverseEvent({ eventName: '', severity: 'Mild', resolutionDate: '' });
      loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Submission failed.');
    }
  };

  // Freeze a Form (CRA/Monitor only)
  const handleFreezeForm = async (formId: number) => {
    if (!confirm('Are you sure you want to FREEZE this form? Once frozen, this record becomes read-only for study site staff.')) {
      return;
    }

    try {
      await apiFetch(`/api/forms/${formId}/freeze`, { method: 'POST' });
      alert('Data successfully verified and locked.');
      loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Freeze action failed.');
    }
  };

  // Trigger Edit Form Mode
  const startEditForm = (form: any) => {
    setEditingFormId(form.id);
    setActiveFormTab(form.form_type);
    
    if (form.form_type === 'VITALS') {
      setVitals({
        heartRate: form.data.heart_rate || '',
        bloodPressure: form.data.blood_pressure || '',
        weight: form.data.weight || ''
      });
    } else if (form.form_type === 'LABS') {
      setLabs({
        wbc: form.data.white_blood_cells || '',
        rbc: form.data.red_blood_cells || '',
        glucose: form.data.glucose || ''
      });
    } else if (form.form_type === 'ADVERSE_EVENTS') {
      setAdverseEvent({
        eventName: form.data.event_name || '',
        severity: form.data.severity || 'Mild',
        resolutionDate: form.data.resolution_date || ''
      });
    }
  };

  const renderFieldQueryFlag = (form: any, fieldName: string) => {
    if (!patient || !patient.consent_signed) return null;
    
    const query = queries.find(q => q.form_id === form.id && q.field_name === fieldName);
    
    // If no query exists
    if (!query) {
      // Show query create button ONLY for CRAs/Monitors
      if (isCra && !form.is_frozen) {
        return (
          <button 
            type="button"
            onClick={() => setActiveQueryModal({ formId: form.id, fieldName, query: null })}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.1rem 0.25rem',
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              marginLeft: '0.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '3px',
              transition: 'all 0.2s'
            }}
            title="Open Discrepancy Note"
            className="query-flag-add"
          >
            💬+
          </button>
        );
      }
      return null;
    }

    // If query exists, render corresponding flag style
    let color = 'var(--color-error)';
    let title = 'Active Discrepancy Note';
    let isPulsing = false;

    if (query.status === 'RESOLVED') {
      color = 'var(--color-warning)';
      title = 'Discrepancy Resolved (Awaiting Review)';
    } else if (query.status === 'CLOSED') {
      color = 'var(--color-success)';
      title = 'Discrepancy Closed & Verified';
    } else if (query.status === 'OPEN') {
      isPulsing = true;
    }

    return (
      <button 
        type="button"
        onClick={() => setActiveQueryModal({ formId: form.id, fieldName, query })}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.1rem 0.25rem',
          color: color,
          fontWeight: 'bold',
          fontSize: '0.85rem',
          marginLeft: '0.25rem',
          display: 'inline-flex',
          alignItems: 'center',
          animation: isPulsing ? 'pulse-flag 1.5s infinite alternate' : 'none',
          borderRadius: '3px'
        }}
        title={title}
      >
        ⚠️
      </button>
    );
  };

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', padding: '2rem' }}>Loading Case Report Form (CRF)...</div>;
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--color-error)', color: 'var(--color-error)' }}>
        {error}
      </div>
    );
  }

  const isCrc = user?.role === 'DATA_ENTRY' || user?.role === 'ADMIN';
  const isCra = user?.role === 'MONITOR' || user?.role === 'ADMIN';

  return (
    <div>
      <style>{`
        @keyframes pulse-flag {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.25); opacity: 1; text-shadow: 0 0 4px var(--color-error); }
        }
        .query-flag-add:hover {
          background: rgba(255,255,255,0.1);
          color: var(--color-primary);
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText style={{ color: 'var(--color-primary)' }} />
            Subject CRF Profile: PT-{String(patient.id).padStart(3, '0')}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Informed Consent & Case Report Form Registry
          </p>
        </div>
        <button onClick={() => router.push('/patients')} className="btn btn-secondary">
          Back to Registry
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Patient Details & Consent Left Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Patient Card */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Subject Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Initials:</span>
                <span style={{ fontWeight: 600 }}>{patient.initials}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Birth Date:</span>
                <span style={{ fontWeight: 600 }}>{new Date(patient.birth_date).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Gender:</span>
                <span style={{ fontWeight: 600 }}>{patient.gender}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Study Status:</span>
                <span className={`badge ${patient.status === 'ENROLLED' ? 'badge-enrolled' : 'badge-screening'}`}>
                  {patient.status}
                </span>
              </div>
            </div>
          </div>

          {/* E-Consent Card */}
          <div className="card" style={{
            borderLeft: patient.consent_signed ? '4px solid var(--color-success)' : '4px solid var(--color-warning)'
          }}>
            <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCheck2 style={{ color: patient.consent_signed ? 'var(--color-success)' : 'var(--color-warning)' }} />
              Informed E-Consent
            </h3>

            {patient.consent_signed ? (
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontWeight: 600, marginBottom: '0.75rem' }}>
                  <ShieldCheck style={{ width: '18px' }} />
                  Digital Signatures Verified
                </div>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Signed on: <strong style={{ color: 'var(--color-text-main)' }}>{new Date(patient.consent_date).toLocaleString()}</strong>
                </p>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Signature Hash:
                </p>
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  wordBreak: 'break-all',
                  borderRadius: '4px',
                  marginTop: '0.25rem'
                }}>
                  {patient.consent_signature_hash}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                  FDA regulations require a signed Informed Consent form on archive before clinical data can be logged.
                </p>
                
                {/* Consent Signing Box (CRC or Patient only) */}
                {(user?.role === 'DATA_ENTRY' || user?.role === 'ADMIN') && (
                  <form onSubmit={handleSignConsent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-color)',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      color: 'var(--color-text-muted)'
                    }}>
                      Study protocol RX-492: I hereby consent to participate in this study. I understand that my records will be fully audited under FDA 21 CFR Part 11 conditions.
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Sign with Initials (Must be: {patient.initials})</label>
                      <input 
                        type="text" 
                        maxLength={4}
                        required
                        className="form-input"
                        placeholder="Initials"
                        value={consentInitials}
                        onChange={(e) => setConsentInitials(e.target.value.toUpperCase())}
                      />
                    </div>

                    <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        required
                        style={{ marginTop: '2px' }}
                        checked={consentCheckbox}
                        onChange={(e) => setConsentCheckbox(e.target.checked)}
                      />
                      <span>I authorize this digital signature for study consent archiving.</span>
                    </label>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}>
                      Submit E-Consent
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* DICOM Scan Viewer Card (Available if consented) */}
          {patient.consent_signed && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', margin: 0 }}>
                  <Activity style={{ color: 'var(--color-primary)' }} />
                  DICOM Medical Image Viewer
                </h3>
                {isCrc && (
                  <button 
                    onClick={() => setShowImportScanModal(true)}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Plus style={{ width: '12px' }} />
                    Import Scan
                  </button>
                )}
              </div>

              {!selectedScan ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  <Upload style={{ width: '28px', height: '28px', margin: '0 auto 0.5rem', display: 'block', color: 'var(--color-text-muted)' }} />
                  No medical scans imported yet for this subject.
                  {isCrc && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <button 
                        onClick={() => setShowImportScanModal(true)}
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', margin: '0 auto', color: '#000' }}
                      >
                        Import First Scan
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Scan Selector */}
                  {scans.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Active Scan Selector:</label>
                      <select 
                        className="form-input" 
                        style={{ fontSize: '0.8rem', padding: '0.35rem', background: '#0a0d1a', color: 'var(--color-text-main)', border: '1px solid var(--border-color)' }}
                        value={selectedScan.id}
                        onChange={(e) => {
                          const scan = scans.find(s => s.id === parseInt(e.target.value, 10));
                          if (scan) {
                            setSelectedScan(scan);
                            setCurrentSlice(Math.floor(scan.slice_count / 2));
                            setDeidentified(false);
                            setAiSegmented(false);
                            setPhiData({
                              name: scan.metadata?.phi_patient_name || `Subject ${patient.initials}`,
                              id: scan.metadata?.phi_patient_id || `PT-${String(patient.id).padStart(3, '0')}`
                            });
                          }
                        }}
                      >
                        {scans.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.scan_type} — {s.scan_date.slice(0, 10)} ({s.slice_count} slices)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Canvas element */}
                  <div style={{ position: 'relative', width: '250px', height: '250px', margin: '0 auto', background: '#000', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <canvas id="dicom-canvas" width={250} height={250} />
                    
                    {/* Overlay PHI Metadata headers */}
                    <div style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '0.65rem', fontFamily: 'monospace', color: '#a0aec0', lineHeight: 1.2, pointerEvents: 'none', background: 'rgba(0,0,0,0.5)', padding: '0.25rem', borderRadius: '4px' }}>
                      <div>ID: {phiData.id}</div>
                      <div>NAME: {phiData.name}</div>
                      <div>SCAN: {selectedScan.scan_type} ({selectedScan.scan_date.slice(0, 10)})</div>
                      <div>SLICES: {selectedScan.slice_count}</div>
                    </div>
                  </div>

                  {/* Slider for Slices */}
                  <div>
                    <label style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                      <span>{selectedScan.scan_type} Slice Navigation</span>
                      <strong>Slice {currentSlice + 1} / {selectedScan.slice_count}</strong>
                    </label>
                    <input 
                      type="range" min={0} max={selectedScan.slice_count - 1} 
                      value={currentSlice} onChange={(e) => setCurrentSlice(parseInt(e.target.value, 10))}
                      style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                    />
                  </div>

                  {/* Contrast / Brightness adjusts */}
                  <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--color-text-muted)' }}>Level (Brightness)</span>
                      <input type="range" min={10} max={90} value={windowLevel} onChange={(e) => setWindowLevel(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--color-text-muted)' }}>Width (Contrast)</span>
                      <input type="range" min={10} max={90} value={windowWidth} onChange={(e) => setWindowWidth(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
                    </div>
                  </div>

                  {/* PHI Strip & AI Segmentation triggers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button 
                      onClick={handleDeidentify} 
                      disabled={deidentified}
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.7rem', justifyContent: 'center', gap: '0.25rem' }}
                    >
                      <EyeOff style={{ width: '12px' }} />
                      De-identify PHI
                    </button>
                    <button 
                      onClick={handleAiSegment} 
                      disabled={segmenting}
                      className="btn btn-primary" 
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.7rem', justifyContent: 'center', gap: '0.25rem', color: '#000' }}
                    >
                      <Sparkles style={{ width: '12px' }} />
                      {segmenting ? 'Analyzing...' : 'AI Segment'}
                    </button>
                  </div>

                  {/* Automated AI Report Draft */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
                      <Sparkles style={{ width: '16px', color: 'var(--color-primary)' }} />
                      <strong style={{ fontSize: '0.85rem' }}>Automated AI Analysis Draft:</strong>
                    </div>
                    <div style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px', 
                      padding: '0.75rem', 
                      fontSize: '0.8rem', 
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-line'
                    }}>
                      {selectedScan.system_report || 'No automated AI draft available for this scan type.'}
                    </div>
                  </div>

                  {/* Clinical Validation Report */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                    {selectedScan.is_validated ? (
                      <div style={{ 
                        border: '2px solid var(--color-success)', 
                        background: 'rgba(16, 185, 129, 0.05)', 
                        borderRadius: '8px', 
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          <Lock style={{ width: '16px' }} />
                          <span>🔒 SIGNED & SEALED BY CLINICIAN</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', whiteSpace: 'pre-line', margin: 0, color: 'var(--color-text-main)' }}>
                          {selectedScan.validated_report}
                        </p>
                        <div style={{ borderTop: '1px solid rgba(16, 185, 129, 0.2)', paddingTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          <div><strong>Validator ID:</strong> {selectedScan.validated_by_id}</div>
                          <div><strong>Signed At:</strong> {new Date(selectedScan.validated_at).toLocaleString()}</div>
                          <div style={{ wordBreak: 'break-all', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem', borderRadius: '4px' }}>
                            <strong>Signature Hash (SHA-256):</strong> {selectedScan.signature_hash}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
                          <Edit2 style={{ width: '16px', color: 'var(--color-primary)' }} />
                          <strong style={{ fontSize: '0.85rem' }}>Clinical Findings & Overrides:</strong>
                        </div>
                        
                        {isCrc ? (
                          <form onSubmit={handleValidateScan} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <textarea
                              className="form-input"
                              rows={5}
                              required
                              value={validationReportText}
                              onChange={(e) => setValidationReportText(e.target.value)}
                              placeholder="Review the AI draft and write the validated clinical findings report..."
                              style={{ width: '100%', fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical' }}
                            />

                            <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.75rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-warning)' }}>FDA 21 CFR Part 11 Electronic Signature</span>
                              
                              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  required
                                  checked={validationCheckbox}
                                  onChange={(e) => setValidationCheckbox(e.target.checked)}
                                  style={{ marginTop: '2px' }}
                                />
                                <span>I certify that I have reviewed the image and findings, and the report is medically accurate. This digital signature seals this record.</span>
                              </label>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Confirm with your Initials:</label>
                                <input
                                  type="text"
                                  maxLength={4}
                                  required
                                  placeholder="Initials"
                                  className="form-input"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: '80px' }}
                                  value={validationInitials}
                                  onChange={(e) => setValidationInitials(e.target.value.toUpperCase())}
                                />
                              </div>
                            </div>

                            <button 
                              type="submit" 
                              className="btn btn-primary" 
                              style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', color: '#000' }}
                              disabled={validatingScan}
                            >
                              {validatingScan ? 'Signing & Sealing...' : '🔒 Approve & Seal Medical Report'}
                            </button>
                          </form>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '6px', fontStyle: 'italic' }}>
                            Awaiting validation and sign-off by a study investigator. Only investigators can edit and validate findings.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* CRF Data Entry Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Lock Cover if consent pending */}
          {!patient.consent_signed ? (
            <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <Lock style={{ width: '48px', height: '48px', color: 'var(--color-warning)', marginBottom: '1rem' }} />
              <h2 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Case Report Form Locked</h2>
              <p style={{ color: 'var(--color-text-muted)', maxWidth: '460px', margin: '0 auto' }}>
                Subject has not completed the Informed Consent protocol. Please sign consent in the left panel to unlock clinical database entries.
              </p>
            </div>
          ) : (
            <>
              {/* Form Entry Panel */}
              {activeFormTab !== 'NONE' && (
                <div className="card" style={{ border: '1px solid var(--color-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                      {editingFormId ? 'Edit Case Report Form' : 'New Case Report Form'}: {activeFormTab} ({selectedEvent} Visit)
                    </h3>

                    {/* FHIR EHR Import Trigger */}
                    {isCrc && (activeFormTab === 'VITALS' || activeFormTab === 'LABS') && (
                      <button 
                        type="button" 
                        onClick={handleOpenFhirImporter}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Database style={{ width: '12px', color: 'var(--color-primary)' }} />
                        Import EHR (FHIR)
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSubmitForm}>
                    {activeFormTab === 'VITALS' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Heart Rate (bpm)</label>
                          <input 
                            type="number" required placeholder="e.g. 72" className="form-input"
                            value={vitals.heartRate} onChange={(e) => setVitals({...vitals, heartRate: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Blood Pressure (mmHg)</label>
                          <input 
                            type="text" required placeholder="e.g. 120/80" className="form-input"
                            value={vitals.bloodPressure} onChange={(e) => setVitals({...vitals, bloodPressure: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Weight (kg)</label>
                          <input 
                            type="number" step="0.1" required placeholder="e.g. 74.5" className="form-input"
                            value={vitals.weight} onChange={(e) => setVitals({...vitals, weight: e.target.value})}
                          />
                        </div>
                      </div>
                    )}

                    {activeFormTab === 'LABS' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">White Blood Cells (x10^9/L)</label>
                          <input 
                            type="number" step="0.01" required placeholder="e.g. 6.5" className="form-input"
                            value={labs.wbc} onChange={(e) => setLabs({...labs, wbc: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Red Blood Cells (x10^12/L)</label>
                          <input 
                            type="number" step="0.01" required placeholder="e.g. 4.8" className="form-input"
                            value={labs.rbc} onChange={(e) => setLabs({...labs, rbc: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Glucose (mg/dL)</label>
                          <input 
                            type="number" required placeholder="e.g. 95" className="form-input"
                            value={labs.glucose} onChange={(e) => setLabs({...labs, glucose: e.target.value})}
                          />
                        </div>
                      </div>
                    )}

                    {activeFormTab === 'ADVERSE_EVENTS' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Event Description</label>
                          <input 
                            type="text" required placeholder="e.g. Severe Headache" className="form-input"
                            value={adverseEvent.eventName} onChange={(e) => setAdverseEvent({...adverseEvent, eventName: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Severity Level</label>
                          <select 
                            className="form-select" value={adverseEvent.severity}
                            onChange={(e) => setAdverseEvent({...adverseEvent, severity: e.target.value})}
                          >
                            <option value="Mild">Mild</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Severe">Severe</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Resolution Date (Optional)</label>
                          <input 
                            type="date" className="form-input"
                            value={adverseEvent.resolutionDate} onChange={(e) => setAdverseEvent({...adverseEvent, resolutionDate: e.target.value})}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                      <button type="button" onClick={() => setActiveFormTab('NONE')} className="btn btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ color: '#000' }}>
                        {editingFormId ? 'Save Case Changes' : 'Submit Clinical Entry'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Event-Grouped Timelines */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 -0.5rem' }}>
                  <ClipboardList />
                  Subject Case Report Form (CRF) Timeline
                </h3>
                
                {['Screening', 'Baseline', 'Week 4', 'Week 12', 'Adverse Event'].map((eventName) => {
                  const eventForms = forms.filter(f => f.event_name === eventName);
                  const isTargeted = selectedEvent === eventName;
                  
                  return (
                    <div 
                      key={eventName}
                      className="card"
                      style={{
                        border: isTargeted ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                        boxShadow: isTargeted ? '0 0 12px rgba(30, 58, 138, 0.25)' : 'none',
                        transition: 'all 0.3s ease-in-out'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <h4 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '1rem', color: isTargeted ? 'var(--color-primary)' : 'inherit' }}>
                          {eventName} Visit Event {isTargeted && <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--color-primary)', marginLeft: '0.5rem' }}>(Active Focus)</span>}
                        </h4>
                        
                        {isCrc && activeFormTab === 'NONE' && (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            {eventName !== 'Adverse Event' ? (
                              <>
                                <button 
                                  onClick={() => { setSelectedEvent(eventName); setActiveFormTab('VITALS'); setEditingFormId(null); }}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <Heart style={{ width: '12px', color: 'var(--color-error)' }} />
                                  + Vitals
                                </button>
                                <button 
                                  onClick={() => { setSelectedEvent(eventName); setActiveFormTab('LABS'); setEditingFormId(null); }}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <Activity style={{ width: '12px', color: 'var(--color-info)' }} />
                                  + Labs
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => { setSelectedEvent('Adverse Event'); setActiveFormTab('ADVERSE_EVENTS'); setEditingFormId(null); }}
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <FileWarning style={{ width: '12px', color: 'var(--color-warning)' }} />
                                + Log AE
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {eventForms.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                          No clinical records submitted for this visit.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {eventForms.map((form) => (
                            <div key={form.id} style={{
                              padding: '1rem',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)',
                              background: 'rgba(0,0,0,0.1)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              position: 'relative'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <strong style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}>{form.form_type}</strong>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                    CRF-{form.id} | Logged: {new Date(form.created_at).toLocaleString()}
                                  </span>
                                </div>

                                {form.is_frozen ? (
                                  <span className="badge badge-frozen" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                                    <Lock style={{ width: '10px' }} />
                                    VERIFIED & FROZEN
                                  </span>
                                ) : (
                                  <span className="badge badge-screening" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                                    <Unlock style={{ width: '10px' }} />
                                    UNLOCKED
                                  </span>
                                )}
                              </div>

                              {/* Form Body Data display */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: '0.75rem',
                                background: 'rgba(0,0,0,0.25)',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem'
                              }}>
                                {form.form_type === 'VITALS' && (
                                  <>
                                    <div>
                                      <span style={{ color: 'var(--color-text-muted)' }}>Heart Rate:</span> 
                                      <strong> {form.data.heart_rate} bpm</strong>
                                      {renderFieldQueryFlag(form, 'heart_rate')}
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--color-text-muted)' }}>Blood Pressure:</span> 
                                      <strong> {form.data.blood_pressure} mmHg</strong>
                                      {renderFieldQueryFlag(form, 'blood_pressure')}
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--color-text-muted)' }}>Weight:</span> 
                                      <strong> {form.data.weight} kg</strong>
                                      {renderFieldQueryFlag(form, 'weight')}
                                    </div>
                                  </>
                                )}
                                {form.form_type === 'LABS' && (
                                  <>
                                    <div>
                                      <span style={{ color: 'var(--color-text-muted)' }}>WBC:</span> 
                                      <strong> {form.data.white_blood_cells} x10^9/L</strong>
                                      {renderFieldQueryFlag(form, 'white_blood_cells')}
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--color-text-muted)' }}>RBC:</span> 
                                      <strong> {form.data.red_blood_cells} x10^12/L</strong>
                                      {renderFieldQueryFlag(form, 'red_blood_cells')}
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--color-text-muted)' }}>Glucose:</span> 
                                      <strong> {form.data.glucose} mg/dL</strong>
                                      {renderFieldQueryFlag(form, 'glucose')}
                                    </div>
                                  </>
                                )}
                                {form.form_type === 'ADVERSE_EVENTS' && (
                                  <>
                                    <div style={{ gridColumn: 'span 2' }}>
                                      <span style={{ color: 'var(--color-text-muted)' }}>Event:</span> 
                                      <strong style={{ color: form.data.severity === 'Severe' ? 'var(--color-error)' : 'inherit' }}> {form.data.event_name}</strong>
                                      {renderFieldQueryFlag(form, 'event_name')}
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--color-text-muted)' }}>Severity:</span> 
                                      <strong> {form.data.severity}</strong>
                                      {renderFieldQueryFlag(form, 'severity')}
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--color-text-muted)' }}>Resolution:</span> 
                                      <strong> {form.data.resolution_date ? new Date(form.data.resolution_date).toLocaleDateString() : 'Active'}</strong>
                                      {renderFieldQueryFlag(form, 'resolution_date')}
                                    </div>
                                  </>
                                )}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                <span>Entered by: {form.entered_by_name || 'System Cache'}</span>
                                
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  {isCrc && !form.is_frozen && (
                                    <button 
                                      onClick={() => {
                                        setSelectedEvent(eventName);
                                        startEditForm(form);
                                      }} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '0.15rem 0.35rem', fontSize: '0.65rem' }}
                                    >
                                      <Edit2 style={{ width: '10px' }} />
                                      Edit
                                    </button>
                                  )}

                                  {isCra && !form.is_frozen && (
                                    <button onClick={() => handleFreezeForm(form.id)} className="btn btn-primary" style={{ padding: '0.15rem 0.35rem', fontSize: '0.65rem', color: '#000' }}>
                                      <Lock style={{ width: '10px' }} />
                                      Freeze
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Discrepancy Query Modal */}
      {activeQueryModal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                <AlertOctagon style={{ color: activeQueryModal.query ? (activeQueryModal.query.status === 'OPEN' ? 'var(--color-error)' : 'var(--color-warning)') : 'var(--color-text-muted)' }} />
                Discrepancy Note / Query: {activeQueryModal.fieldName.replace(/_/g, ' ').toUpperCase()}
              </h3>
              <button 
                onClick={() => setActiveQueryModal(null)}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'transparent' }}
              >
                ✕
              </button>
            </div>

            {/* If no query exists, allow Monitor to OPEN a new query */}
            {!activeQueryModal.query ? (
              <form onSubmit={handleOpenQuery}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Open a new discrepancy note for this data point. The site investigator will be alerted and required to resolve it.
                </p>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Query Description / Discrepancy Concern</label>
                  <textarea 
                    className="form-input" 
                    required 
                    rows={4}
                    placeholder="e.g. Lab value is out of physiological range (e.g. Glucose 950 mg/dL). Please verify or correct."
                    value={queryDescription}
                    onChange={(e) => setQueryDescription(e.target.value)}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setActiveQueryModal(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ color: '#000' }}>
                    Open Discrepancy Note
                  </button>
                </div>
              </form>
            ) : (
              // If query exists, display history and action depending on role
              <div>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Query Status: {activeQueryModal.query.status}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Opened by: {activeQueryModal.query.created_by_name || 'Monitor'}</span>
                  </div>
                  <p style={{ fontStyle: 'italic', color: 'var(--color-text-main)' }}>&ldquo;{activeQueryModal.query.description}&rdquo;</p>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                    Opened on: {new Date(activeQueryModal.query.created_at).toLocaleString()}
                  </div>
                </div>

                {/* If resolved, show resolution description */}
                {activeQueryModal.query.resolution && (
                  <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Site Investigator Resolution:</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>By: {activeQueryModal.query.resolved_by_name || 'CRC'}</span>
                    </div>
                    <p style={{ color: 'var(--color-text-main)' }}>{activeQueryModal.query.resolution}</p>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Resolved on: {new Date(activeQueryModal.query.resolved_at).toLocaleString()}
                    </div>
                  </div>
                )}

                {/* If open and user is DATA_ENTRY, show resolution form */}
                {activeQueryModal.query.status === 'OPEN' && isCrc && (
                  <form onSubmit={handleResolveQuery}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Submit Resolution Response</label>
                      <textarea 
                        className="form-input" 
                        required 
                        rows={3}
                        placeholder="Provide correction description or verification comment..."
                        value={queryResolution}
                        onChange={(e) => setQueryResolution(e.target.value)}
                        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setActiveQueryModal(null)} className="btn btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ color: '#000' }}>
                        Submit Resolution
                      </button>
                    </div>
                  </form>
                )}

                {/* If resolved (or open) and user is CRA/MONITOR, show close button */}
                {activeQueryModal.query.status !== 'CLOSED' && isCra && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    {activeQueryModal.query.status === 'OPEN' && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Awaiting investigator resolution. As a Monitor, you can close this note directly if the data is corrected.
                      </p>
                    )}
                    {activeQueryModal.query.status === 'RESOLVED' && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Investigator has submitted a resolution. Review and close this note to freeze the verification.
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setActiveQueryModal(null)} className="btn btn-secondary">
                        Back
                      </button>
                      <button 
                        type="button" 
                        onClick={handleCloseQuery} 
                        className="btn btn-primary"
                        style={{ color: '#000', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <CheckCircle style={{ width: '14px' }} />
                        Close & Verify Field
                      </button>
                    </div>
                  </div>
                )}

                {activeQueryModal.query.status === 'CLOSED' && (
                  <div style={{ textAlign: 'right' }}>
                    <button type="button" onClick={() => setActiveQueryModal(null)} className="btn btn-secondary">
                      Close Window
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HL7 FHIR Auto-Importer Modal */}
      {showFhirImporter && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                <Database style={{ color: 'var(--color-primary)' }} />
                Hospital EHR Synced Record (HL7 FHIR Bundle)
              </h3>
              <button 
                onClick={() => setShowFhirImporter(false)}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'transparent' }}
              >
                ✕
              </button>
            </div>

            {loadingFhir ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Querying hospital EHR system via FHIR REST API...
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Successfully connected. Found patient matching initials <strong style={{ color: 'var(--color-text-main)' }}>{patient.initials}</strong>. Select observation bundle to sync into CRF fields.
                </p>

                <div style={{
                  background: '#040711',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#38bdf8',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  marginBottom: '1.5rem'
                }}>
                  <pre>{JSON.stringify(fhirBundle, null, 2)}</pre>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowFhirImporter(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={applyFhirDataToForm} 
                    className="btn btn-primary"
                    style={{ color: '#000', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    Import & Auto-Fill Fields
                    <ArrowRight style={{ width: '14px' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Medical Scan Modal */}
      {showImportScanModal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '550px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                <Upload style={{ color: 'var(--color-primary)' }} />
                Import Medical Imaging Scan
              </h3>
              <button 
                onClick={() => setShowImportScanModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'transparent' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportScan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Upload Real Scan Image (PNG / JPG / JPEG)</label>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleImageFileChange}
                  className="form-input"
                  style={{ background: '#0a0f1d', border: '1px solid #1e293b' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Scan Modality</label>
                  <select 
                    className="form-input" 
                    value={importScanType} 
                    onChange={(e) => setImportScanType(e.target.value)}
                    required
                  >
                    <option value="MRI">MRI (Magnetic Resonance Imaging)</option>
                    <option value="CT">CT (Computed Tomography)</option>
                    <option value="Radiography (X-Ray)">Radiography (X-Ray)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Scan Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={importScanDate} 
                    onChange={(e) => setImportScanDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Slice Count</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={importSliceCount} 
                    onChange={(e) => setImportSliceCount(parseInt(e.target.value, 10))}
                    min={1}
                    max={100}
                    required
                    disabled={importScanType === 'Radiography (X-Ray)'}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Body Part</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={importBodyPart} 
                    onChange={(e) => setImportBodyPart(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Scanner Manufacturer</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={importManufacturer} 
                    onChange={(e) => setImportManufacturer(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Institution / Site Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={importInstitution} 
                    onChange={(e) => setImportInstitution(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                  Demographics & PHI Headers (Mock DICOM Tag Simulation)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Patient Name (DICOM Tag 0010,0010)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={importPatientName} 
                      onChange={(e) => setImportPatientName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Patient ID (DICOM Tag 0010,0020)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={importPatientId} 
                      onChange={(e) => setImportPatientId(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                  Simulated AI Segmentation Model Configuration
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={importTumorDetected} 
                      onChange={(e) => setImportTumorDetected(e.target.checked)}
                    />
                    <span>Simulate Lesion/Abnormality detection in AI Pipeline</span>
                  </label>

                  {importTumorDetected && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Suggested Volume (cc)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          className="form-input" 
                          value={importVolumeCc} 
                          onChange={(e) => setImportVolumeCc(parseFloat(e.target.value))}
                          required={importTumorDetected}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Suggested Max Diameter (mm)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          className="form-input" 
                          value={importDiameterMm} 
                          onChange={(e) => setImportDiameterMm(parseFloat(e.target.value))}
                          required={importTumorDetected}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowImportScanModal(false)}
                  className="btn btn-secondary"
                  disabled={importingScan}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ color: '#000', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  disabled={importingScan}
                >
                  {importingScan ? 'Importing...' : 'Import DICOM Scan'}
                  <Upload style={{ width: '14px' }} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
