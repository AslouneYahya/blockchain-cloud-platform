import React, { useState, useEffect } from 'react';
import { getLedgerTransactions, verifyLedgerAudit, simulateTamper } from '../api/auth.js';

export default function LedgerExplorer() {
  const [transactions, setTransactions] = useState([]);
  const [merkleRoot, setMerkleRoot] = useState('');
  const [loading, setLoading] = useState(true);
  const [auditResult, setAuditResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTx, setExpandedTx] = useState(null);

  useEffect(() => {
    fetchLedger();
  }, []);

  async function fetchLedger() {
    setLoading(true);
    try {
      const res = await getLedgerTransactions();
      const txs = res.data?.data || [];
      setTransactions(txs);
      setMerkleRoot(res.data?.merkleRoot || '');
    } catch (err) {
      console.error('Error fetching ledger:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAudit() {
    setVerifying(true);
    try {
      const res = await verifyLedgerAudit();
      setAuditResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  }

  async function handleSimulateTamper(txId) {
    if (!window.confirm(`Simuler une altération illégitime par un attaquant/admin SSH sur la Tx #${txId} ?`)) {
      return;
    }
    try {
      const res = await simulateTamper(txId, 'malicious-crypto-miner:latest');
      alert(`Simulation d'attaque exécutée : ${res.data.auditResult}`);
      fetchLedger();
      handleVerifyAudit();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  }

  const filtered = transactions.filter(tx => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.txId.toString().includes(q) ||
      (tx.signerAddress && tx.signerAddress.toLowerCase().includes(q)) ||
      (tx.blockHash && tx.blockHash.toLowerCase().includes(q)) ||
      (tx.payload?.name && tx.payload.name.toLowerCase().includes(q))
    );
  });

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
      {/* ─── Header & Actions ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: '1.25rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⛓️</span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>
              Explorateur de Registre Immuable (immudb)
            </h2>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Chaque modification d'infrastructure physique est une transaction financière scellée dans l'arbre de Merkle.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={fetchLedger}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#cbd5e1',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            🔄 Actualiser
          </button>

          <button
            onClick={handleVerifyAudit}
            disabled={verifying}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              color: '#fff',
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: verifying ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span>🛡️</span>
            <span>{verifying ? 'Vérification Merkle...' : 'Vérifier Intégrité Cryptographique'}</span>
          </button>
        </div>
      </div>

      {/* ─── Merkle Root Banner ────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.35)',
        border: '1px solid rgba(6, 182, 212, 0.25)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#38bdf8', fontWeight: '700', marginBottom: '0.25rem' }}>
            Racine de Merkle Active (Merkle Root Hash)
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#f1f5f9', wordBreak: 'break-all' }}>
            {merkleRoot || '0x0000000000000000000000000000000000000000000000000000000000000000'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            padding: '0.5rem 0.85rem',
            borderRadius: '8px',
            color: '#38bdf8',
            fontSize: '0.8rem',
            fontWeight: '700',
          }}>
            {transactions.length} Blocs Validés
          </div>
        </div>
      </div>

      {/* ─── Cryptographic Audit Result Banner ────────────────────────────── */}
      {auditResult && (
        <div style={{
          background: auditResult.valid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.2)',
          border: `1px solid ${auditResult.valid ? '#10b981' : '#ef4444'}`,
          borderRadius: '12px',
          padding: '1.15rem 1.25rem',
          marginBottom: '1.5rem',
          color: auditResult.valid ? '#6ee7b7' : '#fca5a5',
        }}>
          <div style={{ fontWeight: '800', fontSize: '1rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{auditResult.valid ? '✅' : '🚨'}</span>
            <span>{auditResult.valid ? 'RAPPORT D\'AUDIT : 100% INVIOLÉ' : 'ALERTE : ALTÉRATION NON AUTORISÉE DÉTECTÉE !'}</span>
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
            {auditResult.reason}
          </div>
        </div>
      )}

      {/* ─── Search & Filter Bar ───────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <input
          type="text"
          placeholder="Rechercher par Tx ID, adresse de wallet (0x...), nom de déploiement ou hash SHA-256..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(15, 23, 42, 0.8)',
            color: '#fff',
            fontSize: '0.88rem',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* ─── Transaction Blocks List ───────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Lecture du registre immudb...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          color: '#94a3b8',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '12px',
        }}>
          Aucune transaction ne correspond à votre filtre.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.slice().reverse().map(tx => {
            const isExpanded = expandedTx === tx.txId;
            return (
              <div
                key={tx.txId}
                style={{
                  background: tx.tampered ? 'rgba(239, 68, 68, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                  border: tx.tampered ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Block header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.85rem',
                  flexWrap: 'wrap',
                  gap: '0.65rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                      color: '#fff',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '0.82rem',
                    }}>
                      Bloc #{tx.txId}
                    </span>
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: '#f8fafc' }}>
                      {tx.payload?.name || 'Déploiement K3s'}
                    </span>
                    <span style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: '#cbd5e1',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                    }}>
                      {tx.type}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      background: tx.consensus?.quorumReached ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: tx.consensus?.quorumReached ? '#34d399' : '#f87171',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                    }}>
                      Raft Quorum: {tx.consensus?.positiveVotes}/{tx.consensus?.totalNodes} Pis
                    </span>

                    <button
                      onClick={() => handleSimulateTamper(tx.txId)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                      title="Simuler une altération illégitime par un admin SSH sur cette ligne de la base"
                    >
                      🧪 Simuler Altération
                    </button>

                    <button
                      onClick={() => setExpandedTx(isExpanded ? null : tx.txId)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#cbd5e1',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {isExpanded ? 'Réduire ▲' : 'Preuves Merkle ▼'}
                    </button>
                  </div>
                </div>

                {/* Hashes and addresses summary */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '0.65rem',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.85rem', borderRadius: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Wallet Signataire (ecrecover) :</div>
                    <div style={{ color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.signerAddress}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.85rem', borderRadius: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Hash du Bloc SHA-256 :</div>
                    <div style={{ color: '#a78bfa', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.blockHash}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.85rem', borderRadius: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Hash Bloc Précédent (Chaîne) :</div>
                    <div style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.previousHash}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.85rem', borderRadius: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Image & Ressources K3s :</div>
                    <div style={{ color: '#34d399' }}>
                      {tx.payload?.image} • {tx.payload?.ramMb}MB RAM • {tx.payload?.cpu} CPU
                    </div>
                  </div>
                </div>

                {/* Expanded Merkle & Raft details */}
                {isExpanded && (
                  <div style={{
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    fontSize: '0.78rem',
                  }}>
                    <div>
                      <strong style={{ color: '#06b6d4' }}>Preuve de Signature Cryptographique :</strong>
                      <div style={{ fontFamily: 'monospace', color: '#cbd5e1', background: 'rgba(0,0,0,0.4)', padding: '0.5rem', borderRadius: '6px', wordBreak: 'break-all', marginTop: '0.25rem' }}>
                        {tx.signature}
                      </div>
                    </div>

                    <div>
                      <strong style={{ color: '#06b6d4' }}>Détails des Votes du Quorum Raft (Raspberry Pis) :</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.35rem' }}>
                        {(tx.consensus?.votes || []).map(v => (
                          <div key={v.nodeId} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                            <div style={{ fontWeight: '700', color: '#38bdf8' }}>{v.nodeId}</div>
                            <div style={{ color: v.vote ? '#34d399' : '#f87171' }}>Vote: {v.vote ? 'YES (Accepté)' : 'NO'}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{v.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
