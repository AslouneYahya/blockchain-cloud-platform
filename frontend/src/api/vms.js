import apiClient from './auth.js';

/**
 * Fetch all verified deployments / containers running on the K3s cluster
 */
export function getVms() {
  return apiClient.get('/deployments');
}

export function getDeployments() {
  return apiClient.get('/deployments');
}

/**
 * Fetch details of a specific deployment
 */
export function getVmById(id) {
  return apiClient.get(`/deployments/${id}`);
}

/**
 * Submit signed deployment request (Step 1 Client-Side Cryptography)
 */
export function createVm(signedPayload) {
  return apiClient.post('/deployments', signedPayload);
}

export function createDeployment(signedPayload) {
  return apiClient.post('/deployments', signedPayload);
}

/**
 * Terminate deployment on K3s and log to immudb
 */
export function deleteVm(id) {
  return apiClient.delete(`/deployments/${id}`);
}

export function stopVm(id) {
  return apiClient.delete(`/deployments/${id}`);
}

export function startVm(id) {
  // Restart simulated
  return apiClient.post(`/deployments/${id}/exec`, { command: 'echo Container restarted' });
}

/**
 * Fetch execution & orchestrator lifecycle logs
 */
export function getVmLogs(id) {
  return apiClient.get(`/deployments/${id}/logs`);
}

/**
 * Fetch generated client-go Kubernetes YAML manifest
 */
export function getManifest(id) {
  return apiClient.get(`/deployments/${id}/manifest`);
}

/**
 * Execute command inside container
 */
export function executeVmCommand(id, command) {
  return apiClient.post(`/deployments/${id}/exec`, { command });
}
