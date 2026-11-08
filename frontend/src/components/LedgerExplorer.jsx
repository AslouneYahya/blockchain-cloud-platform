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
    if (!window.confirm(`Simulate an unauthorized state tamper on Tx #${txId}? This will demonstrate Merkle tree tampering detection.`)) {
      return;
    }
    try {
      const res = await simulateTamper(txId, 'unauthorized-malicious-image:latest');
      alert(`Tamper test executed: ${res.data.auditResult}`);
      fetchLedger();
      handleVerifyAudit();
    } catch (err) {
      alert('Error: ' + err.message);
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
    <div>
      {/* ─── Header & Actions ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#f8fafc' }}>
            Immutable Ledger (immudb)
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Cryptographically chained SHA-256 blocks with Merkle tree integrity
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search tx, hash, signer..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: '#111318',
              border: '1px solid #1f242d',
              borderRadius: '4px',
              padding: '0.4rem 0.65rem',
              color: '#f8fafc',
              fontSize: '0.8rem',
              width: '200px',
            }}
          />

          <button
            onClick={handleVerifyAudit}
            disabled={verifying}
            style={{
              background: '#181b22',
              border: '1px solid #272d38',
              color: '#f8fafc',
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontWeight: '500',
              cursor: verifying ? 'not-allowed' : 'pointer',
            }}
          >
            {verifying ? 'Verifying...' : 'Verify Audit Trail'}
          </button>
        </div>
      </div>

      {/* Audit Banner */}
      {auditResult && (
        <div style={{
          background: auditResult.valid ? '#14201a' : '#27171a',
          border: `1px solid ${auditResult.valid ? '#1e3a2b' : '#3d1d23'}`,
          borderRadius: '6px',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.82rem',
        }}>
          <div>
            <span style={{ fontWeight: '600', color: auditResult.valid ? '#34d399' : '#f87171' }}>
              {auditResult.valid ? '✓ Cryptographic Audit Trail Verified' : '✕ Tampering Detected!'}
            </span>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.15rem' }}>
              {auditResult.reason}
            </div>
          </div>
          <button
            onClick={() => setAuditResult(null)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Ledger Table ──────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
          Loading immudb ledger...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#111318',
          border: '1px solid #1f242d',
          borderRadius: '8px',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.85rem',
        }}>
          No ledger transactions found.
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
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Tx ID</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Workload</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Signer</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Block Hash</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>Quorum</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => {
                const isExpanded = expandedTx === tx.txId;
                const isDeploy = tx.type === 'DEPLOY';

                return (
                  <React.Fragment key={tx.txId}>
                    <tr
                      style={{
                        borderBottom: '1px solid #181b22',
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = '#151820')}
                      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '600', color: '#f8fafc' }}>
                        #{tx.txId}
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          background: isDeploy ? '#172554' : '#201618',
                          color: isDeploy ? '#60a5fa' : '#f87171',
                        }}>
                          {tx.type}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', color: '#f1f5f9' }}>
                        {tx.payload?.name || '—'}
                      </td>

                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                        {tx.signerAddress?.length > 12 ? `${tx.signerAddress.slice(0, 6)}...${tx.signerAddress.slice(-4)}` : tx.signerAddress}
                      </td>

                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#64748b' }}>
                        {tx.blockHash?.slice(0, 14)}...
                      </td>

                      <td style={{ padding: '0.85rem 1rem', color: '#34d399' }}>
                        {tx.consensus?.positiveVotes || 3}/{tx.consensus?.totalNodes || 3}
                      </td>

                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => setExpandedTx(isExpanded ? null : tx.txId)}
                            style={{
                              background: '#181b22',
                              border: '1px solid #272d38',
                              color: '#94a3b8',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>

                          <button
                            onClick={() => handleSimulateTamper(tx.txId)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #3d1d23',
                              color: '#f87171',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                            title="Simulate state modification to test Merkle verification"
                          >
                            Tamper Test
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr style={{ background: '#0d0f14', borderBottom: '1px solid #1f242d' }}>
                        <td colSpan={7} style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.78rem' }}>
                            <div>
                              <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Cryptographic Hashes</div>
                              <div style={{ fontFamily: 'monospace', color: '#cbd5e1', lineHeight: 1.6 }}>
                                <div>Previous: {tx.previousHash}</div>
                                <div>Block: {tx.blockHash}</div>
                                <div>Payload: {tx.payloadHash}</div>
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Client Signature (secp256k1)</div>
                              <div style={{ fontFamily: 'monospace', color: '#cbd5e1', wordBreak: 'break-all' }}>
                                {tx.signature}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
