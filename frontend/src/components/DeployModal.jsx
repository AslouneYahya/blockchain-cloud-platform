import React, { useState } from 'react';
import { connectWallet, signDeploymentPayload, generateNonce } from '../api/crypto.js';
import { createDeployment } from '../api/vms.js';

export default function DeployModal({ onClose, onDeployed }) {
  const [name, setName] = useState('');
  const [image, setImage] = useState('python:3.11-alpine');
  const [ramMb, setRamMb] = useState(512);
  const [cpu, setCpu] = useState(1);
  const [port, setPort] = useState(8000);
  const [replicas, setReplicas] = useState(1);

  // Lifecycle execution steps
  // 0 = Form, 1 = Client Signing, 2 = Go Smart Contract, 3 = Raft Consensus, 4 = immudb Ledger, 5 = K3s Scheduled
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState('');

  const PRESETS = [
    { label: 'Python 3.11 Backend', value: 'python:3.11-alpine', port: 8000, ram: 512 },
    { label: 'Nginx Web Proxy', value: 'nginx:alpine', port: 80, ram: 128 },
    { label: 'Node.js 20 Service', value: 'node:20-alpine', port: 3000, ram: 256 },
    { label: 'Go Microservice', value: 'golang:1.24-alpine', port: 8080, ram: 256 },
  ];

  function applyPreset(p) {
    setImage(p.value);
    setPort(p.port);
    setRamMb(p.ram);
  }

  async function handleDeploy(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Veuillez spécifier un nom de déploiement.');
      return;
    }

    try {
      // ─── STEP 1: Client-Side Cryptography ────────────────────────────────
      setStep(1);
      const conn = await connectWallet();

      const payload = {
        name: name.trim().toLowerCase(),
        image: image.trim(),
        ramMb: Number(ramMb),
        cpu: Number(cpu),
        port: Number(port),
        replicas: Number(replicas),
        timestamp: Math.floor(Date.now() / 1000),
        nonce: generateNonce(),
      };

      // Sign canonical JSON with Private Key via MetaMask / Local Signer
      const { rawPayload, signature } = await signDeploymentPayload(payload, conn.signer);
      setSignaturePreview(signature);

      // ─── STEP 2: Smart Contract Validation (ecrecover + Quota check) ────
      setStep(2);
      await new Promise(r => setTimeout(r, 450));

      // ─── STEP 3: Raft Consensus Agreement ────────────────────────────────
      setStep(3);
      await new Promise(r => setTimeout(r, 450));

      // ─── STEP 4: immudb Cryptographic Ledger Commit ─────────────────────
      setStep(4);
      const res = await createDeployment({
        payload,
        rawPayload,
        signature,
        signerAddress: conn.address,
      });

      // ─── STEP 5: Infrastructure (K3s client-go Orchestration) ───────────
      setStep(5);
      setReceipt(res.data);
      if (onDeployed) onDeployed();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || err.message || 'Erreur lors du déploiement.');
      setStep(0);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: '18px',
        maxWidth: '580px',
        width: '100%',
        color: '#f8fafc',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 35px rgba(6, 182, 212, 0.15)',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.6)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>✍️</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
                Nouveau Déploiement Signé Cryptographiquement
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Signé par clé privée • Accord Raft (Quorum 2/3) • immudb • K3s
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.75rem' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}>
              {error}
            </div>
          )}

          {step > 0 && step < 5 ? (
            /* Visual 5-Step Pipeline execution */
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {step === 1 && '🔐'}
                {step === 2 && '📜'}
                {step === 3 && '🥧'}
                {step === 4 && '⛓️'}
              </div>

              <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8', margin: '0 0 0.5rem 0' }}>
                {step === 1 && '1. Client-Side Cryptography (Signature Clé Privée)'}
                {step === 2 && '2. Go Smart Contract (Validation ecrecover & Quota)'}
                {step === 3 && '3. Consensus Raft (Diffusion & Quorum Pi)'}
                {step === 4 && '4. immudb Ledger (Arbre de Merkle & Scellement)'}
              </h4>

              <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                {step === 1 && 'Votre wallet Web3 signe le payload JSON avec sa clé privée secp256k1...'}
                {step === 2 && 'Le démon Go retrouve mathématiquement l\'adresse publique et contrôle la RAM disponible...'}
                {step === 3 && 'La transaction est soumise au leader Raft et approuvée par quorum majoritaire (2/3 Pis)...'}
                {step === 4 && 'Calcul du hash SHA-256 et insertion dans l\'arbre de Merkle immuable...'}
              </p>

              {signaturePreview && (
                <div style={{
                  background: 'rgba(0,0,0,0.4)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#a78bfa',
                  maxWidth: '460px',
                  margin: '0 auto 1.5rem auto',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  Signature : {signaturePreview}
                </div>
              )}

              {/* Progress step bar */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    style={{
                      width: '36px',
                      height: '6px',
                      borderRadius: '3px',
                      background: i <= step ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                      boxShadow: i <= step ? '0 0 10px rgba(6, 182, 212, 0.5)' : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : step === 5 ? (
            /* Step 5: Completed Receipt */
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🚀</div>
              <h4 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#34d399', margin: '0 0 0.5rem 0' }}>
                Conteneur Déployé & Scellé sur la Blockchain !
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
                La transaction est verrouillée à perpétuité dans immudb et orchestrée sur le cluster K3s.
              </p>

              <div style={{
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '1.1rem',
                textAlign: 'left',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                marginBottom: '1.5rem',
              }}>
                <div>Numéro de Transaction : <strong style={{ color: '#38bdf8' }}>Tx #{receipt?.transaction?.txId}</strong></div>
                <div>Hash de Bloc SHA-256 : <span style={{ color: '#a78bfa' }}>{receipt?.transaction?.blockHash?.slice(0, 32)}...</span></div>
                <div>Racine de Merkle : <span style={{ color: '#06b6d4' }}>{receipt?.transaction?.merkleRoot?.slice(0, 32)}...</span></div>
                <div>Nœud Matériel Assigné : <span style={{ color: '#34d399' }}>{receipt?.deployment?.nodeAssigned}</span></div>
                <div>IP Réseau Interne : <span style={{ color: '#cbd5e1' }}>{receipt?.deployment?.internalIp}:{receipt?.deployment?.port}</span></div>
                <div>Point d'Entrée Ingress : <a href={receipt?.deployment?.ingressUrl} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{receipt?.deployment?.ingressUrl}</a></div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.75rem 2rem',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(6, 182, 212, 0.35)',
                }}
              >
                Accéder au Dashboard
              </button>
            </div>
          ) : (
            /* Step 0: Input Form */
            <form onSubmit={handleDeploy} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#cbd5e1' }}>
                  Nom du Déploiement (Label K3s RFC 1123)
                </label>
                <input
                  type="text"
                  placeholder="ex: python-cluster-backend"
                  value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.95rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#fff',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#cbd5e1' }}>
                  Image Conteneur OCI / Docker
                </label>
                <input
                  type="text"
                  placeholder="ex: python:3.11-alpine"
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.95rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#fff',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                    marginBottom: '0.55rem',
                  }}
                />

                {/* Preset buttons */}
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {PRESETS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => applyPreset(p)}
                      style={{
                        background: image === p.value ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${image === p.value ? '#06b6d4' : 'rgba(255,255,255,0.1)'}`,
                        color: image === p.value ? '#38bdf8' : '#94a3b8',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#cbd5e1' }}>
                    Quota RAM Allouée
                  </label>
                  <select
                    value={ramMb}
                    onChange={e => setRamMb(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#fff',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value={128}>128 MB (Micro Proxy)</option>
                    <option value={256}>256 MB (Standard Service)</option>
                    <option value={512}>512 MB (Recommandé)</option>
                    <option value={1024}>1024 MB (1 GB Compute)</option>
                    <option value={2048}>2048 MB (2 GB Max Quota)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#cbd5e1' }}>
                    Port Interne Conteneur
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={e => setPort(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#e2e8f0',
                    padding: '0.7rem 1.25rem',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.7rem 1.6rem',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(6, 182, 212, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>✍️</span>
                  <span>Signer & Déployer avec Clé Privée</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
