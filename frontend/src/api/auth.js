import axios from 'axios';
import { connectWallet, getOrCreateLocalWallet } from './crypto.js';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach current wallet address to headers for identification
apiClient.interceptors.request.use(config => {
  const currentAddress = localStorage.getItem('connected_wallet_address');
  if (currentAddress) {
    config.headers['X-Wallet-Address'] = currentAddress;
  }
  return config;
});

/**
 * Decentralized login using Web3 Cryptographic Wallet
 */
export async function loginWithWallet() {
  const conn = await connectWallet();
  localStorage.setItem('connected_wallet_address', conn.address);
  localStorage.setItem('connected_wallet_type', conn.type);
  return conn;
}

/**
 * Check decentralized identity
 */
export async function getMe() {
  const address = localStorage.getItem('connected_wallet_address');
  if (!address) {
    return { data: { authenticated: false } };
  }
  const res = await apiClient.get('/auth/me', { params: { address } });
  return res;
}

/**
 * Disconnect Web3 wallet
 */
export async function logout() {
  localStorage.removeItem('connected_wallet_address');
  localStorage.removeItem('connected_wallet_type');
  return Promise.resolve();
}

/**
 * Cluster stats (Hardware RAM/CPU + Raft Leader + Merkle Root)
 */
export function getClusterStats() {
  return apiClient.get('/cluster/stats');
}

/**
 * immudb immutable transactions ledger
 */
export function getLedgerTransactions() {
  return apiClient.get('/ledger');
}

/**
 * Cryptographic audit trail verification (Merkle tree & hash chain)
 */
export function verifyLedgerAudit() {
  return apiClient.get('/ledger/audit');
}

/**
 * Simulate rogue tampering on a database record
 */
export function simulateTamper(txId, newImage) {
  return apiClient.post('/ledger/simulate-tamper', { txId, newImage });
}

export default apiClient;
