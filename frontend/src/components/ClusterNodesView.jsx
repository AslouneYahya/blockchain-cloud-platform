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
    return <div style={{ color: '#94a3b8', padding: '3rem', textAlign: 'center' }}>Chargement de la topologie du cluster...</div>;
  }

  const nodes = stats?.nodes || [];
  const ramUsagePercent = stats ? Math.round((stats.allocatedRamMb / stats.totalRamMb) * 100) : 0;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      padding: '1.75rem',
      color: '#f8fafc',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🥧</span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>
              Cluster Matériel Raspberry Pi & Consensus Raft
            </h2>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Topologie Haute Disponibilité (HA) 3-nœuds physiques avec quorum majoritaire décentralisé.
          </p>
        </div>

        <div style={{
          background: 'rgba(6, 182, 212, 0.15)',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          color: '#38bdf8',
          padding: '0.45rem 1rem',
          borderRadius: '999px',
          fontSize: '0.82rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
          <span>Leader Actif : {stats?.consensusLeader || 'pi-node-01'}</span>
        </div>
      </div>

      {/* ─── Hardware Capacity Meters ──────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem',
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
            Allocation Mémoire Cluster
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#38bdf8', margin: '0.35rem 0' }}>
            {stats?.allocatedRamMb || 0} / {stats?.totalRamMb || 12288} MB
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', margin: '0.5rem 0' }}>
            <div style={{ width: `${ramUsagePercent}%`, height: '100%', background: 'linear-gradient(90deg, #06b6d4, #3b82f6)', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {stats?.availableRamMb || 12288} MB libres sur la capacité totale
          </div>
        </div>

        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
            Ressources Processeur ARM64
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#a78bfa', margin: '0.35rem 0' }}>
            {stats?.allocatedCpu || 0} / {stats?.totalCpuCores || 12} cœurs vCPU
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.65rem' }}>
            3 Nœuds Raspberry Pi 4 Model B (Quad-Core Cortex-A72 @ 1.5GHz)
          </div>
        </div>

        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
            Règle de Quorum Raft
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#34d399', margin: '0.35rem 0' }}>
            Majorité : ≥ 2 / 3 Nœuds
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.65rem' }}>
            Tolérance aux pannes : 1 Pi hors ligne n'interrompt pas le consensus
          </div>
        </div>
      </div>

      {/* ─── Individual Raspberry Pi Hardware Cards ───────────────────────── */}
      <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem', color: '#f8fafc' }}>
        Nœuds Physiques Participatifs
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {nodes.map(node => {
          const isLeader = node.role === 'Leader';
          const nodeRamPercent = Math.round((node.usedRamMb / node.totalRamMb) * 100);

          return (
            <div
              key={node.name}
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: isLeader ? '1.5px solid #06b6d4' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '1.35rem',
                boxShadow: isLeader ? '0 0 20px rgba(6, 182, 212, 0.2)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '800', color: '#f8fafc', fontSize: '1rem' }}>
                  {node.name}
                </div>
                <span style={{
                  background: isLeader ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                }}>
                  {node.role}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', color: '#94a3b8' }}>
                <div>Adresse IP Réseau : <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{node.ip}</span></div>
                <div>Statut Consensus : <strong style={{ color: '#34d399' }}>● {node.status}</strong></div>
                <div>
                  Charge CPU : <strong style={{ color: '#a78bfa' }}>{node.cpuUsage}%</strong>
                </div>
                <div>
                  Mémoire Utilisée : <strong style={{ color: '#38bdf8' }}>{node.usedRamMb} / {node.totalRamMb} MB ({nodeRamPercent}%)</strong>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.35rem' }}>
                    <div style={{ width: `${nodeRamPercent}%`, height: '100%', background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
