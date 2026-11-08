import React, { useState, useEffect, useRef } from 'react';
import { getVmLogs } from '../api/vms.js';

export default function VmLiveLogsModal({ vm, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef(null);

  async function fetchLogs() {
    try {
      const res = await getVmLogs(vm.id);
      const list = res.data?.logs || res.data?.data || [];
      setLogs(list);
    } catch (err) {
      console.error('Erreur chargement logs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [vm.id]);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '1rem',
    }}>
      <div style={{
        background: '#0a0f1d',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: '16px',
        maxWidth: '800px',
        width: '100%',
        height: '75vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(6, 182, 212, 0.1)',
        color: '#f8fafc',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.6)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>📋</span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                Journaux Pod K3s & Preuve immudb : {vm.name}
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Streaming en direct • Vérifié par racine de Merkle SHA-256
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Terminal logs viewport */}
        <div style={{
          flex: 1,
          padding: '1.25rem',
          overflowY: 'auto',
          fontFamily: "'Fira Code', Consolas, monospace",
          fontSize: '0.8rem',
          background: '#070b14',
          lineHeight: 1.6,
        }}>
          {loading && logs.length === 0 ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Connexion au flux de logs...</div>
          ) : logs.length === 0 ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Aucun log disponible pour ce conteneur.</div>
          ) : (
            logs.map((logLine, idx) => {
              const text = typeof logLine === 'string' ? logLine : (logLine.message || JSON.stringify(logLine));
              const isAudit = text.includes('immudb') || text.includes('Merkle');
              const isK8s = text.includes('K3s') || text.includes('client-go');
              const isSuccess = text.includes('successfully') || text.includes('started');

              let color = '#cbd5e1';
              if (isAudit) color = '#a78bfa';
              else if (isK8s) color = '#38bdf8';
              else if (isSuccess) color = '#34d399';

              return (
                <div key={idx} style={{ display: 'flex', gap: '0.75rem', color }}>
                  <span style={{ color: '#64748b', userSelect: 'none' }}>{(idx + 1).toString().padStart(2, '0')}</span>
                  <span style={{ wordBreak: 'break-all' }}>{text}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
