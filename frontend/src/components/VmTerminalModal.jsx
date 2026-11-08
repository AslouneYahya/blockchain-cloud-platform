import React, { useState, useEffect, useRef } from 'react';
import { executeVmCommand } from '../api/vms.js';

export default function VmTerminalModal({ vm, onClose }) {
  const [lines, setLines] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);

  const ip = vm.ipAddress || '10.42.10.52';
  const prompt = `chainops@${vm.name}:~$ `;

  useEffect(() => {
    const banner = [
      `Connected to pod "${vm.name}" (${ip}) on K3s node.`,
      `Type standard Linux commands (e.g. 'uname -a', 'ps aux', 'uptime') and press Enter:`,
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
        const output = res.data?.output || 'Command executed.';
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
        maxWidth: '800px',
        width: '100%',
        height: '70vh',
        display: 'flex',
        flexDirection: 'column',
        color: '#f8fafc',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid #1f242d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#f8fafc' }}>
              Terminal: {vm.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Container execution shell ({ip})
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.1rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Terminal Screen */}
        <div
          onClick={() => inputRef.current && inputRef.current.focus()}
          style={{
            flex: 1,
            padding: '1rem',
            background: '#090a0f',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            color: '#cbd5e1',
            cursor: 'text',
          }}
        >
          {lines.map((line, idx) => (
            <div key={idx} style={{ whiteSpace: 'pre-wrap' }}>
              {line}
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#38bdf8', marginRight: '0.25rem' }}>{prompt}</span>
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isExecuting}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                padding: 0,
              }}
            />
          </div>
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
