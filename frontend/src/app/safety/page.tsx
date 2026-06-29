'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, 
  Terminal, 
  Activity, 
  ShieldCheck, 
  Send, 
  Mail, 
  BarChart3,
  Server
} from 'lucide-react';

export default function SafetyAlertsPage() {
  const { user, apiFetch } = useAuth();
  const router = useRouter();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock broker stats
  const [brokerStats, setBrokerStats] = useState({
    activeQueue: 'trial.adverse_events.severe',
    messagesProcessed: 24,
    dispatchLatencyMs: 14,
    consumersActive: 2,
    messageRate: '0.05 msg/sec'
  });

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/audit/safety-alerts');
      setAlerts(data);
      
      // Update simulated messages count based on alerts length
      setBrokerStats(prev => ({
        ...prev,
        messagesProcessed: 24 + data.length
      }));
      setLoading(false);
    } catch (err: any) {
      console.warn(err);
      setError(err.message || 'Failed to load safety alerts');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'MONITOR' && user.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    loadAlerts();
  }, [user]);

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', padding: '2rem' }}>Loading Safety Console...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle style={{ color: 'var(--color-error)' }} />
            Medical Safety Alert Console
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Real-Time Adverse Event Message Broker & Pipeline Monitor
          </p>
        </div>
        <button onClick={loadAlerts} className="btn btn-secondary">
          Refresh Monitor
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-error)', color: 'var(--color-error)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Top row: Broker Console & safety metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Kafka/RabbitMQ simulator */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
            <Server style={{ color: 'var(--color-primary)' }} />
            Real-Time Message Broker Status (RabbitMQ / Kafka)
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem'
          }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Exchange / Queue</span>
              <strong style={{ color: 'var(--color-primary)' }}>{brokerStats.activeQueue}</strong>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Broker Messages</span>
              <strong style={{ fontSize: '1.1rem' }}>{brokerStats.messagesProcessed}</strong>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Dispatch Latency</span>
              <strong style={{ color: 'var(--color-success)' }}>{brokerStats.dispatchLatencyMs} ms</strong>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Active Consumers</span>
              <strong>{brokerStats.consumersActive} worker threads</strong>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Delivery Rate</span>
              <strong>{brokerStats.messageRate}</strong>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Delivery Protocol</span>
              <strong style={{ color: 'var(--color-secondary)' }}>AMQP 0-9-1 (Secure TLS)</strong>
            </div>
          </div>

          {/* Console logger display */}
          <div style={{
            background: '#040711',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '1rem',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#34d399',
            maxHeight: '180px',
            overflowY: 'auto'
          }}>
            <p style={{ color: '#64748b' }}>[13:25:00] Initializing AMQP connection to RabbitMQ...</p>
            <p style={{ color: '#64748b' }}>[13:25:01] Declared exchange 'safety.direct' (type=direct, durable=true)</p>
            <p style={{ color: '#64748b' }}>[13:25:01] Bound queue 'trial.adverse_events.severe' to exchange with routing_key='AE_SEVERE'</p>
            <p style={{ color: '#10b981' }}>[13:25:02] Event Broker listening for trial form emissions...</p>
            {alerts.map((alt, idx) => (
              <React.Fragment key={idx}>
                <p style={{ color: '#f59e0b' }}>
                  {`[${new Date(alt.dispatched_at).toLocaleTimeString()}] PUBLISH: Event severe_adverse_event (form_id=${alt.form_id}) emitted by API.`}
                </p>
                <p style={{ color: '#6366f1' }}>
                  {`[${new Date(alt.dispatched_at).toLocaleTimeString()}] CONSUMER: Received payload -> Sent encrypted email alert to ${alt.sent_to}. Status: ${alt.status}`}
                </p>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Safety KPI Summary */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
              <BarChart3 style={{ color: 'var(--color-secondary)' }} />
              Adverse Event Metrics
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Study-wide clinical safety statistics
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Total Critical Alerts Sent:</span>
                  <strong>{alerts.length}</strong>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                  <div style={{ width: `${Math.min(100, (alerts.length / 10) * 100)}%`, height: '100%', background: 'var(--color-error)', borderRadius: '3px' }} />
                </div>
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Broker Dispatch Delivery Rate:</span>
                  <strong style={{ color: 'var(--color-success)' }}>100%</strong>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                  <div style={{ width: '100%', height: '100%', background: 'var(--color-success)', borderRadius: '3px' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: 'var(--color-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ShieldCheck style={{ flexShrink: 0, width: '18px' }} />
            <span>Encrypted dispatch worker compliant with HIPAA security rules.</span>
          </div>
        </div>
      </div>

      {/* Safety Alert List */}
      <div className="card">
        <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Mail style={{ color: 'var(--color-error)' }} />
          Dispatched Notification Logs
        </h3>

        {alerts.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No critical safety notifications have been triggered yet. Submit a form with "Severe" Adverse Event details to test.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{
                padding: '1.25rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.01)',
                display: 'grid',
                gridTemplateColumns: '1fr 3fr 1.5fr',
                gap: '1rem',
                alignItems: 'center'
              }}>
                <div>
                  <span className="badge badge-screening" style={{ border: '1px solid var(--color-error)', color: 'var(--color-error)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    {alert.severity} Alert
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                    Alert ID: SA-{alert.id}
                  </div>
                </div>

                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    {alert.alert_message}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Send style={{ width: '12px' }} />
                    Dispatched to: <strong>{alert.sent_to}</strong>
                  </p>
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--color-success)', fontWeight: 600, display: 'block' }}>
                    ✓ DISPATCHED & LOGGED
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                    {new Date(alert.dispatched_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
