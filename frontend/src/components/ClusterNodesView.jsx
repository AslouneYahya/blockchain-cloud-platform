import React, { useState, useEffect } from 'react';
import { getClusterStats } from '../api/auth.js';

export default function ClusterNodesView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 4000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const res = await getClusterStats();
      setStats(res.data?.data);
    } catch (err) {
      console.error('Error fetching cluster stats:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !stats) {
    return <div style={{ color: '#64748b', padding: '3rem', textAlign: 'center', fontSize: '0.875rem' }}>Loading cluster nodes...</div>;
  }

  const nodes = stats?.nodes || [];

  return (
    <div>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#f8fafc' }}>
            Cluster Nodes & Raft Consensus
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Physical Raspberry Pi nodes running K3s and Raft quorum state engine
          </span>
        </div>

        <div style={{
          display: 'flex',
          gap: '0.75rem',
          fontSize: '0.78rem',
          color: '#94a3b8',
        }}>
          <span>Nodes: <strong style={{ color: '#f8fafc' }}>{nodes.length}</strong></span>
          <span>•</span>
          <span>Total RAM: <strong style={{ color: '#f8fafc' }}>12 GB</strong></span>
          <span>•</span>
          <span>vCPU: <strong style={{ color: '#f8fafc' }}>12 Cores</strong></span>
        </div>
      </div>

      {/* ─── Node Cards ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {nodes.map(node => {
          const isLeader = node.role === 'Leader';
          const ramPercent = Math.round((node.usedRamMb / node.totalRamMb) * 100);

          return (
            <div
              key={node.name}
              style={{
                background: '#111318',
                border: '1px solid #1f242d',
                borderRadius: '8px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#f8fafc' }}>
                    {node.name}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                    IP: {node.ip}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    background: isLeader ? '#172554' : '#181b22',
                    color: isLeader ? '#60a5fa' : '#94a3b8',
                    border: `1px solid ${isLeader ? '#1e3a8a' : '#272d38'}`,
                  }}>
                    {node.role}
                  </span>

                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '500',
                    background: '#14201a',
                    color: '#34d399',
                    border: '1px solid #1e3a2b',
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                    {node.status}
                  </span>
                </div>
              </div>

              {/* Resource Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    <span>RAM Usage</span>
                    <span style={{ color: '#cbd5e1' }}>{node.usedRamMb} / {node.totalRamMb} MB ({ramPercent}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: '#1f242d', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${ramPercent}%`, height: '100%', background: '#2563eb' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    <span>CPU Load</span>
                    <span style={{ color: '#cbd5e1' }}>{node.cpuUsagePercent}%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: '#1f242d', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${node.cpuUsagePercent}%`, height: '100%', background: '#10b981' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Consensus Protocol Summary ────────────────────────────────────── */}
      <div style={{
        background: '#111318',
        border: '1px solid #1f242d',
        borderRadius: '8px',
        padding: '1.25rem',
      }}>
        <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#f8fafc', marginBottom: '0.75rem' }}>
          Raft Consensus Protocol Parameters
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          fontSize: '0.78rem',
        }}>
          <div>
            <div style={{ color: '#64748b' }}>Quorum Requirement</div>
            <div style={{ color: '#f1f5f9', fontWeight: '500', marginTop: '0.15rem' }}>Majority Quorum (N/2 + 1 = 2 Pis)</div>
          </div>
          <div>
            <div style={{ color: '#64748b' }}>Active Leader</div>
            <div style={{ color: '#f1f5f9', fontWeight: '500', marginTop: '0.15rem' }}>{stats?.consensusLeader || 'pi-node-01'}</div>
          </div>
          <div>
            <div style={{ color: '#64748b' }}>Heartbeat Timer</div>
            <div style={{ color: '#f1f5f9', fontWeight: '500', marginTop: '0.15rem' }}>150 ms</div>
          </div>
          <div>
            <div style={{ color: '#64748b' }}>Election Timeout</div>
            <div style={{ color: '#f1f5f9', fontWeight: '500', marginTop: '0.15rem' }}>300 ms – 500 ms</div>
          </div>
        </div>
      </div>
    </div>
  );
}
