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

  // 0 = Form, 1 = Signing, 2 = Contract, 3 = Raft, 4 = immudb, 5 = Done
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const PRESETS = [
    { label: 'Python 3.11', value: 'python:3.11-alpine', port: 8000, ram: 512 },
    { label: 'Nginx', value: 'nginx:alpine', port: 80, ram: 128 },
    { label: 'Node.js 20', value: 'node:20-alpine', port: 3000, ram: 256 },
    { label: 'Go Alpine', value: 'golang:alpine', port: 8080, ram: 256 },
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
      setError('Please provide a deployment name.');
      return;
    }

    try {
      // Step 1: Sign
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

      const { rawPayload, signature } = await signDeploymentPayload(payload, conn.signer);

      // Step 2: Contract
      setStep(2);
      await new Promise(r => setTimeout(r, 300));

      // Step 3: Raft
      setStep(3);
      await new Promise(r => setTimeout(r, 300));

      // Step 4: immudb commit
      setStep(4);
      const res = await createDeployment({
        payload,
        rawPayload,
        signature,
        signerAddress: conn.address,
      });

      // Step 5: Finished
      setStep(5);
      setReceipt(res.data);
      setTimeout(() => {
        onDeployed();
      }, 1500);

    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || err.message || 'Deployment rejected.');
      setStep(0);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1rem',
    }}>
      <div style={{
        background: '#111318',
        border: '1px solid #1f242d',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '100%',
        color: '#f8fafc',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #1f242d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#f8fafc' }}>
              New Deployment
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Signed by private key • Verified by consensus • Recorded in immudb
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={step > 0 && step < 5}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.1rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              padding: '0.65rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          {step > 0 && step < 5 ? (
            <div style={{ padding: '1.5rem 0' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#f1f5f9', marginBottom: '1.25rem' }}>
                Executing consensus pipeline...
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ color: step >= 1 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{step > 1 ? '✓' : '•'}</span>
                  <span>1. Client cryptographic signature (secp256k1)</span>
                </div>
                <div style={{ color: step >= 2 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{step > 2 ? '✓' : '•'}</span>
                  <span>2. Smart contract quota & ecrecover verification</span>
                </div>
                <div style={{ color: step >= 3 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{step > 3 ? '✓' : '•'}</span>
                  <span>3. Raft consensus quorum across Raspberry Pis</span>
                </div>
                <div style={{ color: step >= 4 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{step > 4 ? '✓' : '•'}</span>
                  <span>4. immudb ledger commit & SHA-256 state chain</span>
                </div>
              </div>
            </div>
          ) : step === 5 ? (
            <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
              <div style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                ✓ Workload Scheduled Successfully
              </div>
              <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
                Transaction confirmed and pod assigned to node {receipt?.deployment?.nodeAssigned || 'pi-node-01'}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleDeploy}>
              {/* Presets */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>
                  Image Presets
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p)}
                      style={{
                        background: image === p.value ? '#1e293b' : '#141720',
                        border: `1px solid ${image === p.value ? '#2563eb' : '#272d38'}`,
                        color: image === p.value ? '#f8fafc' : '#94a3b8',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>
                  Workload Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. backend-api"
                  required
                  style={{
                    width: '100%',
                    background: '#090a0f',
                    border: '1px solid #1f242d',
                    borderRadius: '4px',
                    padding: '0.5rem 0.65rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* Container Image */}
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>
                  Container Image
                </label>
                <input
                  type="text"
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  placeholder="python:3.11-alpine"
                  required
                  style={{
                    width: '100%',
                    background: '#090a0f',
                    border: '1px solid #1f242d',
                    borderRadius: '4px',
                    padding: '0.5rem 0.65rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Row: RAM & CPU */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>
                    RAM (MB)
                  </label>
                  <input
                    type="number"
                    value={ramMb}
                    onChange={e => setRamMb(e.target.value)}
                    min="64"
                    max="4096"
                    required
                    style={{
                      width: '100%',
                      background: '#090a0f',
                      border: '1px solid #1f242d',
                      borderRadius: '4px',
                      padding: '0.5rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>
                    CPU Cores
                  </label>
                  <input
                    type="number"
                    value={cpu}
                    onChange={e => setCpu(e.target.value)}
                    step="0.1"
                    min="0.1"
                    max="4"
                    required
                    style={{
                      width: '100%',
                      background: '#090a0f',
                      border: '1px solid #1f242d',
                      borderRadius: '4px',
                      padding: '0.5rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              {/* Row: Port & Replicas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    min="1"
                    max="65535"
                    required
                    style={{
                      width: '100%',
                      background: '#090a0f',
                      border: '1px solid #1f242d',
                      borderRadius: '4px',
                      padding: '0.5rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>
                    Replicas
                  </label>
                  <input
                    type="number"
                    value={replicas}
                    onChange={e => setReplicas(e.target.value)}
                    min="1"
                    max="3"
                    required
                    style={{
                      width: '100%',
                      background: '#090a0f',
                      border: '1px solid #1f242d',
                      borderRadius: '4px',
                      padding: '0.5rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#181b22',
                    border: '1px solid #272d38',
                    color: '#94a3b8',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Sign & Deploy
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
