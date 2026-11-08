import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithWallet } from '../api/auth.js';

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
      console.error(err);
      setError(err?.message || 'Erreur lors de la connexion du portefeuille Web3.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 20%, #111e38 0%, #070b14 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background ambient glow */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '350px',
        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      {/* Main Container */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '520px',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(6, 182, 212, 0.1)',
        padding: '2.5rem 2.25rem',
      }}>
        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.75rem' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            boxShadow: '0 8px 24px rgba(6, 182, 212, 0.4)',
          }}>
            ⛓️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: '800', fontSize: '1.35rem', letterSpacing: '-0.5px', color: '#fff' }}>
                ChainOps
              </span>
              <span style={{
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: '700',
                letterSpacing: '0.5px',
              }}>
                TESTNET
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Decentralized Autonomous Cloud & immudb Ledger
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: '1.45rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
          Portail d'Accès Web3
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1.75rem 0', lineHeight: 1.55 }}>
          L'infrastructure est traitée comme un registre financier. Aucune base de données centralisée d'utilisateurs ni mot de passe : votre <strong>Clé Privée</strong> signe et autorise chaque opération.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
          }}>
            {error}
          </div>
        )}

        {/* Wallet Connect Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.75rem' }}>
          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(59, 130, 246, 0.2) 100%)',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px rgba(6, 182, 212, 0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🦊</span>
              <span>{hasMetaMask ? 'Connecter MetaMask' : 'Connecter Portefeuille Web3'}</span>
            </div>
            <span style={{
              background: hasMetaMask ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: hasMetaMask ? '#34d399' : '#60a5fa',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '600',
            }}>
              {hasMetaMask ? '● Détecté' : 'EIP-1193'}
            </span>
          </button>

          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#cbd5e1',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔑</span>
              <span>Générer Clé de Développement Locale (secp256k1)</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>1-Click</span>
          </button>
        </div>

        {/* Live Cluster Topology Ribbon */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          fontSize: '0.75rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          <div>
            <div style={{ color: '#94a3b8' }}>Consensus</div>
            <div style={{ fontWeight: '700', color: '#38bdf8' }}>Raft HA (3 Pis)</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8' }}>Registre</div>
            <div style={{ fontWeight: '700', color: '#a78bfa' }}>immudb Merkle</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8' }}>Orchestrateur</div>
            <div style={{ fontWeight: '700', color: '#34d399' }}>K3s client-go</div>
          </div>
        </div>

        {/* 5-Step Architecture walkthrough */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '1.25rem',
          fontSize: '0.78rem',
          color: '#94a3b8',
        }}>
          <div style={{ fontWeight: '700', color: '#cbd5e1', marginBottom: '0.65rem' }}>
            Processus d'Exécution Cryptographique en 5 Étapes :
          </div>
          <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li><strong>Client-Side Cryptography :</strong> Signature du JSON par clé privée.</li>
            <li><strong>Smart Contract (Go) :</strong> <code>ecrecover</code> public key & quotas RAM.</li>
            <li><strong>Consensus Raft :</strong> Quorum majoritaire approuvé entre Raspberry Pis.</li>
            <li><strong>Registre immudb :</strong> Hachage SHA-256 scellé dans l'arbre de Merkle.</li>
            <li><strong>Orchestration K3s :</strong> Génération YAML & Pod déployé sur le nœud physique.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
