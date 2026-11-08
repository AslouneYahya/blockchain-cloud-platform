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
      console.error('Error fetching logs:', err);
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
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1rem',
    }}>
      <div style={{
        background: '#111318',
        border: '1px solid #1f242d',
        borderRadius: '8px',
        maxWidth: '750px',
        width: '100%',
        height: '70vh',
        display: 'flex',
        flexDirection: 'column',
        color: '#f8fafc',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid #1f242d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#f8fafc' }}>
              Pod Logs: {vm.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Live stream from K3s container runtime
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.1rem', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Console output */}
        <div style={{
          flex: 1,
          padding: '1rem',
          background: '#090a0f',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.78rem',
          lineHeight: 1.5,
          color: '#cbd5e1',
        }}>
          {loading && logs.length === 0 ? (
            <div style={{ color: '#64748b' }}>Connecting to pod stream...</div>
          ) : logs.length === 0 ? (
            <div style={{ color: '#64748b' }}>No log entries recorded.</div>
          ) : (
            logs.map((logLine, idx) => (
              <div key={idx} style={{ marginBottom: '0.2rem' }}>
                <span style={{ color: '#64748b', marginRight: '0.5rem' }}>{idx + 1}</span>
                <span>{logLine}</span>
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
