import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, logout, getClusterStats } from '../api/auth.js';
import VmManager from '../components/VmManager.jsx';
import LedgerExplorer from '../components/LedgerExplorer.jsx';
import ClusterNodesView from '../components/ClusterNodesView.jsx';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('deployments'); // 'deployments', 'ledger', 'nodes', 'contract'
  const [loading, setLoading] = useState(true);
  const [copiedRoot, setCopiedRoot] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  async function checkAuth() {
    try {
      const res = await getMe();
      if (!res.data?.authenticated) {
        navigate('/login');
        return;
      }
      setUser(res.data);
    } catch (err) {
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await getClusterStats();
      setStats(res.data?.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function copyMerkleRoot() {
    if (stats?.merkleRoot) {
      navigator.clipboard.writeText(stats.merkleRoot);
      setCopiedRoot(true);
      setTimeout(() => setCopiedRoot(false), 2000);
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#070b14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#38bdf8',
        fontSize: '1.1rem',
        fontWeight: '600',
        fontFamily: "'Fira Code', monospace",
      }}>
        [SYNCHRONIZING WITH CLUSTER LEDGER...]
      </div>
    );
  }

  const walletAddr = user?.address || localStorage.getItem('connected_wallet_address') || '0x...';
  const walletShort = walletAddr.length > 12 ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : walletAddr;
  const merkleRoot = stats?.merkleRoot || '0x0000000000000000000000000000000000000000000000000000000000000000';
  const merkleShort = merkleRoot.length > 16 ? `${merkleRoot.slice(0, 10)}...${merkleRoot.slice(-6)}` : merkleRoot;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #0d1527 0%, #070b14 60%)',
      color: '#f1f5f9',
    }}>
      {/* ─── Top Web3 Header & Ticker ────────────────────────────────────────── */}
      <header style={{
        background: 'rgba(11, 18, 33, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0 1.75rem',
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Left: Brand & Network Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: '0 4px 16px rgba(6, 182, 212, 0.35)',
          }}>
            ⛓️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: '800', fontSize: '1.15rem', letterSpacing: '-0.3px', color: '#fff' }}>
                ChainOps Cloud
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.1rem 0.45rem',
                borderRadius: '6px',
                fontSize: '0.68rem',
                fontWeight: '700',
              }}>
                ● K3s Raft HA
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
              Chain ID: 31337 • immudb v1.9 • client-go
            </div>
          </div>
        </div>

        {/* Center: Live Merkle Root Ticker (Desktop) */}
        <div style={{
          display: 'none',
          '@media (minWidth: 900px)': { display: 'flex' },
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '999px',
          padding: '0.35rem 0.85rem',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
        }}>
          <span style={{ color: '#06b6d4', fontWeight: '700' }}>🌳 Merkle Root:</span>
          <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }} title={merkleRoot}>
            {merkleShort}
          </span>
          <button
            onClick={copyMerkleRoot}
            style={{
              background: 'none',
              border: 'none',
              color: copiedRoot ? '#34d399' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0 0.25rem',
            }}
            title="Copier le Hash Merkle"
          >
            {copiedRoot ? '✓' : '📋'}
          </button>
        </div>

        {/* Right: Connected Wallet & Disconnect */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '0.4rem 0.85rem',
            borderRadius: '999px',
            fontSize: '0.82rem',
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
            }} />
            <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#38bdf8' }} title={walletAddr}>
              {walletShort}
            </span>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Déconnecter
          </button>
        </div>
      </header>

      {/* ─── Main Content Area ──────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1320px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Quick telemetry ribbons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
              RAM Allouée / Capacité Quorum
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#38bdf8', margin: '0.3rem 0' }}>
              {stats?.allocatedRamMb || 0} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/ {stats?.totalRamMb || 12288} MB</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
              ● {stats?.availableRamMb || 12288} MB disponible pour nouveaux conteneurs
            </div>
          </div>

          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
              Consensus Leader (Raspberry Pi)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#a78bfa', margin: '0.3rem 0' }}>
              {stats?.consensusLeader || 'pi-node-01'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Quorum Raft HA : 3/3 Nœuds Synchronisés
            </div>
          </div>

          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
              Transactions Scellées immudb
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#34d399', margin: '0.3rem 0' }}>
              {stats?.totalTxs || 0} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Blocs</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Chaque modification est inviolable et auditable
            </div>
          </div>

          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
              Charges Actives (K3s Pods)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#f59e0b', margin: '0.3rem 0' }}>
              {stats?.activePods || 0} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Pods</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Routage Ingress Traefik automatique
            </div>
          </div>
        </div>

        {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '0.65rem',
          marginBottom: '1.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '0.75rem',
          overflowX: 'auto',
        }}>
          <button
            onClick={() => setActiveTab('deployments')}
            style={{
              background: activeTab === 'deployments' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === 'deployments' ? '#06b6d4' : 'transparent'}`,
              color: activeTab === 'deployments' ? '#38bdf8' : '#94a3b8',
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>🚀</span>
            <span>Conteneurs & Charges K3s</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            style={{
              background: activeTab === 'ledger' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === 'ledger' ? '#06b6d4' : 'transparent'}`,
              color: activeTab === 'ledger' ? '#38bdf8' : '#94a3b8',
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>⛓️</span>
            <span>Explorateur de Registre (immudb)</span>
          </button>

          <button
            onClick={() => setActiveTab('nodes')}
            style={{
              background: activeTab === 'nodes' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === 'nodes' ? '#06b6d4' : 'transparent'}`,
              color: activeTab === 'nodes' ? '#38bdf8' : '#94a3b8',
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>🥧</span>
            <span>Topologie Nœuds & Raft</span>
          </button>

          <button
            onClick={() => setActiveTab('contract')}
            style={{
              background: activeTab === 'contract' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === 'contract' ? '#06b6d4' : 'transparent'}`,
              color: activeTab === 'contract' ? '#38bdf8' : '#94a3b8',
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>📜</span>
            <span>Règles Smart Contract (Go)</span>
          </button>
        </div>

        {/* ─── Active Tab Rendering ─────────────────────────────────────────── */}
        {activeTab === 'deployments' && <VmManager />}
        {activeTab === 'ledger' && <LedgerExplorer />}
        {activeTab === 'nodes' && <ClusterNodesView />}
        {activeTab === 'contract' && (
          <div style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '1.75rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#fff' }}>
              📜 Règles du Smart Contract (Démon Go Cluster)
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.5rem 0' }}>
              Contrat déterministe exécuté par le démon Go avant qu'une transaction ne puisse être proposée au consensus Raft et enregistrée dans immudb.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <strong style={{ color: '#38bdf8' }}>1. Authentification Cryptographique</strong>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>
                  Signature <code>secp256k1</code> vérifiée avec <code>ecrecover</code>. L'adresse publique déduite doit correspondre au signataire de la requête.
                </p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <strong style={{ color: '#38bdf8' }}>2. Plafond Matériel RAM Cluster</strong>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>
                  Limite stricte de <strong>12,288 MB</strong> (3x Raspberry Pi 4GB). Rejet immédiat si l'allocation demandée dépasse la capacité disponible.
                </p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <strong style={{ color: '#38bdf8' }}>3. Quotas par Conteneur</strong>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>
                  Min 64 MB / Max 2,048 MB RAM par déploiement. Max 4.0 cœurs vCPU.
                </p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <strong style={{ color: '#38bdf8' }}>4. Conformité DNS & Nommage</strong>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>
                  Noms de déploiements conformes à la norme RFC 1123 de Kubernetes (alphanumérique minuscule et tirets, max 63 caractères).
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
