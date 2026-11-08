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
    if (!window.confirm(`Confirmer la résiliation cryptographiquement vérifiée de '${name}' sur le cluster K3s ?`)) {
      return;
    }
    try {
      await deleteVm(name);
      loadDeployments();
    } catch (err) {
      alert('Erreur: ' + (err?.response?.data?.error || err.message));
    }
  }

  async function handleShowManifest(name) {
    try {
      const res = await getManifest(name);
      setManifestModal({ name, yaml: res.data?.manifest });
    } catch (err) {
      alert('Erreur lors du chargement du manifest: ' + err.message);
    }
  }

  return (
    <div>
      {/* ─── Top Bar ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '0.85rem',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#f8fafc' }}>
            Conteneurs & Charges Orchestrées (K3s)
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Pods exécutés sur les Raspberry Pis après validation Smart Contract et accord de quorum Raft
          </span>
        </div>

        <button
          onClick={() => setShowDeployModal(true)}
          style={{
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            border: 'none',
            color: '#fff',
            padding: '0.7rem 1.4rem',
            borderRadius: '10px',
            fontWeight: '700',
            fontSize: '0.92rem',
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(6, 182, 212, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>✍️</span>
          <span>Signer & Déployer un Conteneur</span>
        </button>
      </div>

      {/* ─── Deployments Grid ──────────────────────────────────────────────── */}
      {loading && deployments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
          Chargement des déploiements...
        </div>
      ) : deployments.length === 0 ? (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px dashed rgba(6, 182, 212, 0.3)',
          borderRadius: '16px',
          padding: '4rem 1.5rem',
          textAlign: 'center',
          color: '#94a3b8',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📦</div>
          <h3 style={{ color: '#f1f5f9', margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700' }}>
            Aucun conteneur actif sur le cluster
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', maxWidth: '480px', marginInline: 'auto' }}>
            Configurez un déploiement et signez le avec votre clé privée Web3 pour déclencher le pipeline décentralisé.
          </p>
          <button
            onClick={() => setShowDeployModal(true)}
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              color: '#fff',
              border: 'none',
              padding: '0.65rem 1.5rem',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)',
            }}
          >
            Déployer le Premier Conteneur
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.35rem' }}>
          {deployments.map(dep => {
            const isRunning = dep.phase === 'Running';

            return (
              <div
                key={dep.deploymentId}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '1.35rem',
                  color: '#f8fafc',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#fff' }}>
                          {dep.name}
                        </h3>
                        <span style={{
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: '#38bdf8',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          fontWeight: '700',
                        }}>
                          Tx #{dep.txId}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                        {dep.image}
                      </div>
                    </div>

                    <span style={{
                      background: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: isRunning ? '#34d399' : '#f87171',
                      border: `1px solid ${isRunning ? '#10b981' : '#ef4444'}`,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                    }}>
                      ● {dep.phase}
                    </span>
                  </div>

                  <div style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    marginBottom: '1.15rem',
                  }}>
                    <div>Nœud Hardware Pi : <strong style={{ color: '#38bdf8' }}>{dep.nodeAssigned}</strong></div>
                    <div>Ressources : <strong style={{ color: '#cbd5e1' }}>{dep.ramMb} MB RAM • {dep.cpu} vCPU</strong></div>
                    <div>IP Pod Réseau : <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{dep.internalIp}:{dep.port}</span></div>
                    <div>Ingress Traefik : <a href={dep.ingressUrl} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>{dep.ingressUrl}</a></div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedTerminalVm({ id: dep.name, name: dep.name, os: 'Linux 5.15 ARM64 (K3s Pod)', ipAddress: dep.internalIp, cpu: dep.cpu, ramMb: dep.ramMb, diskGb: 10 })}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    💻 SSH
                  </button>

                  <button
                    onClick={() => setSelectedLogsVm({ id: dep.name, name: dep.name, status: dep.phase })}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Logs
                  </button>

                  <button
                    onClick={() => handleShowManifest(dep.name)}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    ☸️ Manifest
                  </button>

                  <button
                    onClick={() => handleTerminate(dep.name)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                    title="Résiliation cryptographiquement vérifiée"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Manifest Modal ────────────────────────────────────────────────── */}
      {manifestModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem',
        }}>
          <div style={{
            background: '#090e17',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '16px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            color: '#f8fafc',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
          }}>
            <div style={{
              padding: '1.15rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '1rem' }}>
                  ☸️ Instructions Kubernetes Manifest (client-go) : {manifestModal.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Généré déterministement à partir de la transaction immudb
                </div>
              </div>
              <button
                onClick={() => setManifestModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <pre style={{
              padding: '1.5rem',
              margin: 0,
              overflowY: 'auto',
              fontFamily: "'Fira Code', Consolas, monospace",
              fontSize: '0.82rem',
              color: '#38bdf8',
              lineHeight: 1.5,
            }}>
              {manifestModal.yaml}
            </pre>
          </div>
        </div>
      )}

      {/* Modals */}
      {showDeployModal && (
        <DeployModal
          onClose={() => setShowDeployModal(false)}
          onDeployed={loadDeployments}
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
