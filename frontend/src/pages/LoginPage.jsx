import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithWallet } from '../api/auth.js';
import { getOrCreateLocalWallet } from '../api/crypto.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      setHasMetaMask(true);
    }
  }, []);

  async function handleConnect() {
    setLoading(true);
    setError('');
    try {
      await loginWithWallet();
      navigate('/dashboard');
    } catch (err) {
      console.error('Wallet connection error:', err);
      // Fallback to local dev keypair if browser provider fails
      try {
        const local = getOrCreateLocalWallet();
        localStorage.setItem('connected_wallet_address', local.address);
        localStorage.setItem('connected_wallet_type', 'Local Keypair (secp256k1)');
        navigate('/dashboard');
      } catch (fallbackErr) {
        setError(err?.message || 'Failed to authenticate with Web3 wallet.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLocalOperator() {
    setLoading(true);
    try {
      const local = getOrCreateLocalWallet();
      localStorage.setItem('connected_wallet_address', local.address);
      localStorage.setItem('connected_wallet_type', 'Local Keypair (secp256k1)');
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to generate local keypair: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#111318',
        border: '1px solid #1f242d',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#f8fafc', letterSpacing: '-0.3px' }}>
              ChainOps
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Infrastructure Control Plane
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f1f5f9', margin: '0 0 0.4rem 0' }}>
          Sign in
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
          Authenticate using your Web3 wallet. Each infrastructure request is cryptographically signed and verified by cluster smart contract rules.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            padding: '0.75rem 0.9rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            marginBottom: '1.25rem',
            lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.15s ease',
            }}
            onMouseOver={e => !loading && (e.currentTarget.style.background = '#1d4ed8')}
            onMouseOut={e => !loading && (e.currentTarget.style.background = '#2563eb')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
            {loading ? 'Authenticating...' : (hasMetaMask ? 'Connect MetaMask' : 'Connect Web3 Wallet')}
          </button>

          <button
            onClick={handleLocalOperator}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              border: '1px solid #272d38',
              background: '#181b22',
              color: '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={e => !loading && (e.currentTarget.style.background = '#1f242d')}
            onMouseOut={e => !loading && (e.currentTarget.style.background = '#181b22')}
          >
            Enter as Local Operator (Generated secp256k1 Key)
          </button>
        </div>

        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #1f242d',
          fontSize: '0.75rem',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Raft Quorum: Active</span>
          <span>Ledger: immudb</span>
        </div>
      </div>
    </div>
  );
}
