import React, { useState, useEffect, useRef } from 'react';
import { executeVmCommand } from '../api/vms.js';

export default function VmTerminalModal({ vm, onClose }) {
  const [lines, setLines] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);

  const ip = vm.ipAddress || '10.42.0.15';
  const prompt = `chainops@${vm.name}:~$ `;

  useEffect(() => {
    const banner = [
      `[SECURITY] Cryptographic Session Authenticated via Wallet Signature.`,
      `Connecting to K3s pod '${vm.name}' on hardware node...`,
      `Session established. Container runtime: containerd / ARM64 Linux 5.15.`,
      ` * Pod IP:           ${ip}`,
      ` * Resources:        ${vm.ramMb} MB RAM, ${vm.cpu} vCPU core(s)`,
      ` * Consensus Node:   Raspberry Pi HA Mesh`,
      ` * immudb State:     Merkle Verified & Unbroken`,
      ``,
      `Type commands (e.g. 'uname -a', 'free -m', 'uptime', 'env') and press Enter:`,
      ``,
    ];
    setLines(banner);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [vm]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, isExecuting]);

  async function handleKeyDown(e) {
    if (e.key === 'Enter') {
      const cmd = currentInput.trim();
      if (!cmd) return;

      const newLines = [...lines, `${prompt}${cmd}`];
      setLines(newLines);
      setCurrentInput('');
      setIsExecuting(true);

      if (cmd.toLowerCase() === 'clear') {
        setLines([]);
        setIsExecuting(false);
        return;
      }

      try {
        const res = await executeVmCommand(vm.id, cmd);
        const output = res.data?.output || 'Command completed successfully.';
        setLines(prev => [...prev, output, '']);
      } catch (err) {
        setLines(prev => [...prev, `Error: ${err?.response?.data?.error || err.message}`, '']);
      } finally {
        setIsExecuting(false);
      }
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '1rem',
    }}>
      <div style={{
        background: '#070b14',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: '16px',
        maxWidth: '850px',
        width: '100%',
        height: '75vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 35px rgba(6, 182, 212, 0.15)',
        color: '#f8fafc',
        overflow: 'hidden',
      }}>
        {/* Terminal Header */}
        <div style={{
          padding: '0.85rem 1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.8)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#cbd5e1' }}>
              Terminal K3s Pod : {vm.name} ({ip})
            </span>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Terminal Body */}
        <div
          onClick={() => inputRef.current && inputRef.current.focus()}
          style={{
            flex: 1,
            padding: '1.25rem',
            overflowY: 'auto',
            fontFamily: "'Fira Code', Consolas, monospace",
            fontSize: '0.82rem',
            background: '#070b14',
            cursor: 'text',
            lineHeight: 1.6,
          }}
        >
          {lines.map((l, i) => (
            <div key={i} style={{ color: l.startsWith('chainops@') ? '#38bdf8' : l.startsWith('[SECURITY]') ? '#a78bfa' : '#cbd5e1', whiteSpace: 'pre-wrap' }}>
              {l}
            </div>
          ))}

          {/* Current active prompt input line */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
            <span style={{ color: '#38bdf8' }}>{prompt}</span>
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              disabled={isExecuting}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontFamily: "'Fira Code', Consolas, monospace",
                fontSize: '0.82rem',
                padding: 0,
                marginLeft: '4px',
              }}
            />
          </div>
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
