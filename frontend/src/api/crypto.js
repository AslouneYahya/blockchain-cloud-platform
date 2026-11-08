import { ethers } from 'ethers';

const LOCAL_WALLET_KEY = 'inpt_cluster_dev_wallet_key';

/**
 * Get or create a local fallback Web3 wallet for development if MetaMask is not present
 */
export function getOrCreateLocalWallet() {
  let privateKey = localStorage.getItem(LOCAL_WALLET_KEY);
  if (!privateKey) {
    const randomWallet = ethers.Wallet.createRandom();
    privateKey = randomWallet.privateKey;
    localStorage.setItem(LOCAL_WALLET_KEY, privateKey);
  }
  return new ethers.Wallet(privateKey);
}

/**
 * Detect available Web3 wallet provider (MetaMask or fallback local dev key)
 */
export async function connectWallet() {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      return {
        type: 'MetaMask',
        address,
        signer,
      };
    } catch (err) {
      console.warn('MetaMask connection rejected or failed, falling back to local dev key:', err);
    }
  }

  // Fallback to local cryptographic wallet
  const localWallet = getOrCreateLocalWallet();
  return {
    type: 'Local Keypair (secp256k1)',
    address: localWallet.address,
    signer: localWallet,
  };
}

/**
 * Format deterministic JSON string of payload to guarantee reproducible cryptographic hashes
 */
export function canonicalJSONString(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * Sign payload using the connected Web3 wallet's private key (Step 1 of Architecture)
 */
export async function signDeploymentPayload(payload, signer) {
  const rawJSON = JSON.stringify(payload);
  let signature;

  if (signer.signMessage) {
    // ethers Signer (works with both BrowserProvider and Wallet)
    signature = await signer.signMessage(rawJSON);
  } else if (typeof window !== 'undefined' && window.ethereum) {
    // Direct personal_sign fallback
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    const from = accounts[0];
    signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [rawJSON, from],
    });
  } else {
    throw new Error('No cryptographic signer available');
  }

  return {
    rawPayload: rawJSON,
    signature,
  };
}

/**
 * Generate a cryptographically random nonce
 */
export function generateNonce() {
  return '0x' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
