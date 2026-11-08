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
  const [activeTab, setActiveTab] = useState('deployments'); // 'deployments', 'nodes', 'ledger'
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
        background: '#090a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: '0.9rem',
      }}>
        Loading cluster console...
      </div>
    );
  }

  const walletAddr = user?.address || localStorage.getItem('connected_wallet_address') || '0x...';
  const walletShort = walletAddr.length > 12 ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : walletAddr;
  const merkleRoot = stats?.merkleRoot || '0x0000000000000000000000000000000000000000000000000000000000000000';
  const merkleShort = merkleRoot.length > 16 ? `${merkleRoot.slice(0, 10)}...${merkleRoot.slice(-6)}` : merkleRoot;

  const ramAllocated = stats?.allocatedRamMb || 0;
  const ramTotal = stats?.totalRamMb || 12288;
  const ramPercent = Math.min(100, Math.round((ramAllocated / ramTotal) * 100));

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090a0f',
      color: '#f1f5f9',
    }}>
      {/* ─── Top Navigation Header ────────────────────────────────────────────── */}
      <header style={{
        background: '#111318',
        borderBottom: '1px solid #1f242d',
        padding: '0 1.5rem',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </div>
          <span style={{ fontWeight: '700', fontSize: '1rem', color: '#f8fafc', letterSpacing: '-0.2px' }}>
            ChainOps
          </span>
          <span style={{
            background: '#14201a',
            color: '#34d399',
            border: '1px solid #1e3a2b',
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: '500',
          }}>
            Cluster Healthy
          </span>
        </div>

        {/* Center: Merkle Root Hash */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#090a0f',
          border: '1px solid #1f242d',
          borderRadius: '6px',
          padding: '0.3rem 0.65rem',
          fontSize: '0.75rem',
        }}>
          <span style={{ color: '#64748b' }}>Merkle Root:</span>
          <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }} title={merkleRoot}>
            {merkleShort}
          </span>
          <button
            onClick={copyMerkleRoot}
            style={{
              background: 'none',
              border: 'none',
              color: copiedRoot ? '#34d399' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0 0.2rem',
            }}
            title="Copy Merkle Hash"
          >
            {copiedRoot ? '✓' : 'Copy'}
          </button>
        </div>

        {/* Right: Wallet & Sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#181b22',
            border: '1px solid #272d38',
            borderRadius: '6px',
            padding: '0.3rem 0.65rem',
            fontSize: '0.8rem',
            color: '#e2e8f0',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontFamily: 'monospace' }}>{walletShort}</span>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid #272d38',
              color: '#94a3b8',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
            onMouseOver={e => (e.currentTarget.style.color = '#f1f5f9')}
            onMouseOut={e => (e.currentTarget.style.color = '#94a3b8')}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ─── Main Content Container ───────────────────────────────────────────── */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.75rem 1.5rem' }}>
        
        {/* Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}>
          {/* Card 1: RAM Quota */}
          <div style={{
            background: '#111318',
            border: '1px solid #1f242d',
            borderRadius: '8px',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500', marginBottom: '0.4rem' }}>
              Smart Contract RAM Quota
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#f8fafc' }}>
              {ramAllocated} <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>/ {ramTotal} MB</span>
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              background: '#1f242d',
              borderRadius: '2px',
              marginTop: '0.75rem',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${ramPercent}%`,
                height: '100%',
                background: ramPercent > 80 ? '#ef4444' : '#2563eb',
              }} />
            </div>
          </div>

          {/* Card 2: Active Deployments */}
          <div style={{
            background: '#111318',
            border: '1px solid #1f242d',
            borderRadius: '8px',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500', marginBottom: '0.4rem' }}>
              Active Workloads
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#f8fafc' }}>
              {stats?.activePods ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              K3s Pods Scheduled
            </div>
          </div>

          {/* Card 3: Raft Consensus */}
          <div style={{
            background: '#111318',
            border: '1px solid #1f242d',
            borderRadius: '8px',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500', marginBottom: '0.4rem' }}>
              Consensus State
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#f8fafc' }}>
              3/3 Quorum
            </div>
            <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.5rem' }}>
              Leader: {stats?.consensusLeader || 'pi-node-01'}
            </div>
          </div>

          {/* Card 4: Ledger Transactions */}
          <div style={{
            background: '#111318',
            border: '1px solid #1f242d',
            borderRadius: '8px',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500', marginBottom: '0.4rem' }}>
              immudb Ledger
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#f8fafc' }}>
              {stats?.totalTxs ?? 0} <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>Transactions</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              SHA-256 Merkle Chain Active
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #1f242d',
          marginBottom: '1.5rem',
        }}>
          <button
            onClick={() => setActiveTab('deployments')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'deployments' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'deployments' ? '#f8fafc' : '#94a3b8',
              padding: '0.65rem 1rem',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'deployments' ? '600' : '500',
              cursor: 'pointer',
            }}
          >
            Deployments ({stats?.activePods ?? 0})
          </button>

          <button
            onClick={() => setActiveTab('nodes')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'nodes' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'nodes' ? '#f8fafc' : '#94a3b8',
              padding: '0.65rem 1rem',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'nodes' ? '600' : '500',
              cursor: 'pointer',
            }}
          >
            Nodes & Consensus
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'ledger' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'ledger' ? '#f8fafc' : '#94a3b8',
              padding: '0.65rem 1rem',
              fontSize: '0.875rem',
              fontWeight: activeTab === 'ledger' ? '600' : '500',
              cursor: 'pointer',
            }}
          >
            Audit Ledger ({stats?.totalTxs ?? 0})
          </button>
        </div>

        {/* Tab View */}
        {activeTab === 'deployments' && <VmManager />}
        {activeTab === 'nodes' && <ClusterNodesView />}
        {activeTab === 'ledger' && <LedgerExplorer />}

      </main>
    </div>
  );
}
