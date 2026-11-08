import React, { useState, useEffect } from 'react';
import { getDeployments, deleteVm, getManifest } from '../api/vms.js';
import DeployModal from './DeployModal.jsx';
import VmLiveLogsModal from './VmLiveLogsModal.jsx';
import VmTerminalModal from './VmTerminalModal.jsx';

export default function VmManager() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedLogsVm, setSelectedLogsVm] = useState(null);
  const [selectedTerminalVm, setSelectedTerminalVm] = useState(null);
  const [manifestModal, setManifestModal] = useState(null);
  const [copiedManifest, setCopiedManifest] = useState(false);

  useEffect(() => {
    loadDeployments();
    const interval = setInterval(loadDeployments, 4000);
    return () => clearInterval(interval);
  }, []);

  async function loadDeployments() {
    try {
      const res = await getDeployments();
      const list = res.data?.data || [];
      setDeployments(list);
    } catch (err) {
      console.error('Error loading deployments:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTerminate(name) {
    if (!window.confirm(`Terminate deployment "${name}"? This action will record a termination transaction in immudb.`)) {
      return;
    }
    try {
      await deleteVm(name);
      loadDeployments();
    } catch (err) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    }
  }

  async function handleShowManifest(name) {
    try {
      const res = await getManifest(name);
      setManifestModal({ name, yaml: res.data?.manifest });
    } catch (err) {
      alert('Failed to load Kubernetes manifest: ' + err.message);
    }
  }

  function copyManifest() {
    if (manifestModal?.yaml) {
      navigator.clipboard.writeText(manifestModal.yaml);
      setCopiedManifest(true);
      setTimeout(() => setCopiedManifest(false), 2000);
    }
  }

  return (
    <div>
      {/* ─── Action Bar ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#f8fafc' }}>
            Workloads
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            K3s pods managed by smart contract rules and Raft consensus
          </span>
        </div>

        <button
          onClick={() => setShowDeployModal(true)}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#1d4ed8')}
          onMouseOut={e => (e.currentTarget.style.background = '#2563eb')}
        >
          <span>+</span> Deploy Workload
        </button>
      </div>

      {/* ─── Workloads Table / Cards ───────────────────────────────────────── */}
      {loading && deployments.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
          Loading deployments...
        </div>
      ) : deployments.length === 0 ? (
        <div style={{
          background: '#111318',
          border: '1px solid #1f242d',
          borderRadius: '8px',
          padding: '3rem 1.5rem',
          textAlign: 'center',
        }}>
          <h3 style={{ color: '#f1f5f9', margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: '600' }}>
            No active workloads
          </h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: '#64748b' }}>
            Deploy a container to schedule pods on physical Raspberry Pis across the consensus quorum.
          </p>
          <button
            onClick={() => setShowDeployModal(true)}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Deploy Workload
          </button>
        </div>
      ) : (
        <div style={{
          background: '#111318',
          border: '1px solid #1f242d',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#0d0f14', borderBottom: '1px solid #1f242d', color: '#64748b' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Workload</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Hardware Node</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Resources</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Network IP</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map(dep => {
                const isRunning = dep.phase === 'Running';

                return (
                  <tr
                    key={dep.deploymentId}
                    style={{
                      borderBottom: '1px solid #181b22',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = '#151820')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Workload & Image */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: '600', color: '#f8fafc' }}>
                        {dep.name}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                        {dep.image}
                      </div>
                    </td>

                    {/* Hardware Node */}
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>
                      {dep.nodeAssigned || 'pi-node-01'}
                    </td>

                    {/* Resources */}
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>
                      {dep.ramMb} MB • {dep.cpu} vCPU
                    </td>

                    {/* Network IP & Ingress */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>
                        {dep.internalIp || '10.42.0.x'}:{dep.port}
                      </div>
                      {dep.ingressUrl && (
                        <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: '0.15rem' }}>
                          {dep.ingressUrl}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: isRunning ? '#14201a' : '#201618',
                        color: isRunning ? '#34d399' : '#f87171',
                        border: `1px solid ${isRunning ? '#1e3a2b' : '#3d1d23'}`,
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isRunning ? '#10b981' : '#ef4444',
                        }} />
                        {dep.phase}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          onClick={() => setSelectedLogsVm({ id: dep.name, name: dep.name, status: dep.phase })}
                          style={{
                            background: '#181b22',
                            border: '1px solid #272d38',
                            color: '#94a3b8',
                            padding: '0.3rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          onMouseOver={e => (e.currentTarget.style.color = '#f1f5f9')}
                          onMouseOut={e => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          Logs
                        </button>

                        <button
                          onClick={() => handleShowManifest(dep.name)}
                          style={{
                            background: '#181b22',
                            border: '1px solid #272d38',
                            color: '#94a3b8',
                            padding: '0.3rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          onMouseOver={e => (e.currentTarget.style.color = '#f1f5f9')}
                          onMouseOut={e => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          YAML
                        </button>

                        <button
                          onClick={() => setSelectedTerminalVm({ id: dep.name, name: dep.name, os: 'Linux ARM64 (K3s Pod)', ipAddress: dep.internalIp, cpu: dep.cpu, ramMb: dep.ramMb })}
                          style={{
                            background: '#181b22',
                            border: '1px solid #272d38',
                            color: '#94a3b8',
                            padding: '0.3rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          onMouseOver={e => (e.currentTarget.style.color = '#f1f5f9')}
                          onMouseOut={e => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          Exec
                        </button>

                        {isRunning && (
                          <button
                            onClick={() => handleTerminate(dep.name)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #3d1d23',
                              color: '#f87171',
                              padding: '0.3rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = '#27171a')}
                            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            Terminate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Manifest YAML Modal ───────────────────────────────────────────── */}
      {manifestModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1.5rem',
        }}>
          <div style={{
            background: '#111318',
            border: '1px solid #1f242d',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '650px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid #1f242d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#f8fafc' }}>
                Manifest: {manifestModal.name}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={copyManifest}
                  style={{
                    background: '#181b22',
                    border: '1px solid #272d38',
                    color: copiedManifest ? '#34d399' : '#94a3b8',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {copiedManifest ? 'Copied' : 'Copy YAML'}
                </button>
                <button
                  onClick={() => setManifestModal(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ padding: '1rem 1.25rem', maxHeight: '420px', overflowY: 'auto' }}>
              <pre style={{
                margin: 0,
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                color: '#cbd5e1',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
              }}>
                {manifestModal.yaml}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modals */}
      {showDeployModal && (
        <DeployModal
          onClose={() => setShowDeployModal(false)}
          onDeployed={() => {
            setShowDeployModal(false);
            loadDeployments();
          }}
        />
      )}

      {selectedLogsVm && (
        <VmLiveLogsModal
          vm={selectedLogsVm}
          onClose={() => setSelectedLogsVm(null)}
        />
      )}

      {selectedTerminalVm && (
        <VmTerminalModal
          vm={selectedTerminalVm}
          onClose={() => setSelectedTerminalVm(null)}
        />
      )}
    </div>
  );
}
