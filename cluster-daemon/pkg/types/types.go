package types

import "time"

// DeploymentPayload represents the canonical JSON payload signed by the user's wallet.
type DeploymentPayload struct {
	Name        string            `json:"name"`
	Image       string            `json:"image"`
	RamMb       int64             `json:"ramMb"`
	Cpu         float64           `json:"cpu"`
	Port        int32             `json:"port"`
	Replicas    int32             `json:"replicas"`
	Env         map[string]string `json:"env,omitempty"`
	Timestamp   int64             `json:"timestamp"`
	Nonce       string            `json:"nonce"`
	AccessMode  string            `json:"accessMode,omitempty"` // "web", "ssh", "api"
	Description string            `json:"description,omitempty"`
}

// SignedDeploymentRequest is the payload sent from the React frontend.
type SignedDeploymentRequest struct {
	Payload       DeploymentPayload `json:"payload"`
	RawPayload    string            `json:"rawPayload,omitempty"`
	Signature     string            `json:"signature"`
	SignerAddress string            `json:"signerAddress"`
}

// SignedActionRequest is used for stopping, restarting or terminating deployments with cryptographic proof.
type SignedActionRequest struct {
	Action        string `json:"action"` // "STOP", "START", "TERMINATE", "EXEC"
	DeploymentID  string `json:"deploymentId"`
	Command       string `json:"command,omitempty"`
	Timestamp     int64  `json:"timestamp"`
	Nonce         string `json:"nonce"`
	Signature     string `json:"signature"`
	SignerAddress string `json:"signerAddress"`
}

// ConsensusVote tracks an individual Raspberry Pi node's vote during Raft agreement.
type ConsensusVote struct {
	NodeID    string    `json:"nodeId"`
	Vote      bool      `json:"vote"`
	Reason    string    `json:"reason"`
	VotedAt   time.Time `json:"votedAt"`
	Signature string    `json:"signature"`
}

// ConsensusReceipt records the Raft quorum agreement across Raspberry Pis.
type ConsensusReceipt struct {
	Term          int64           `json:"term"`
	LeaderNode    string          `json:"leaderNode"`
	TotalNodes    int             `json:"totalNodes"`
	PositiveVotes int             `json:"positiveVotes"`
	QuorumReached bool            `json:"quorumReached"`
	Votes         []ConsensusVote `json:"votes"`
}

// LedgerTransaction represents a permanent, cryptographically verified record in immudb.
type LedgerTransaction struct {
	TxID          uint64            `json:"txId"`
	Timestamp     time.Time         `json:"timestamp"`
	Type          string            `json:"type"` // "DEPLOY", "TERMINATE", "SCALE"
	SignerAddress string            `json:"signerAddress"`
	PayloadHash   string            `json:"payloadHash"`   // SHA-256 of payload
	PreviousHash  string            `json:"previousHash"`  // SHA-256 chain link
	BlockHash     string            `json:"blockHash"`     // Current SHA-256(previousHash + payloadHash + txId + timestamp)
	MerkleRoot    string            `json:"merkleRoot"`    // Merkle tree root hash
	Signature     string            `json:"signature"`     // User's cryptographic signature
	Payload       DeploymentPayload `json:"payload"`
	Consensus     ConsensusReceipt  `json:"consensus"`
	Tampered      bool              `json:"tampered,omitempty"`
}

// K3sDeploymentStatus represents the physical infrastructure state in K3s.
type K3sDeploymentStatus struct {
	DeploymentID string    `json:"deploymentId"`
	Name         string    `json:"name"`
	Namespace    string    `json:"namespace"`
	Image        string    `json:"image"`
	RamMb        int64     `json:"ramMb"`
	Cpu          float64   `json:"cpu"`
	Port         int32     `json:"port"`
	Replicas     int32     `json:"replicas"`
	ReadyReplicas int32    `json:"readyReplicas"`
	Phase        string    `json:"phase"` // "Pending", "Running", "Failed", "Terminated"
	NodeAssigned string    `json:"nodeAssigned"` // Raspberry Pi node hostname
	IngressURL   string    `json:"ingressUrl"`
	InternalIP   string    `json:"internalIp"`
	CreatedAt    time.Time `json:"createdAt"`
	TxID         uint64    `json:"txId"`
	BlockHash    string    `json:"blockHash"`
	OwnerAddress string    `json:"ownerAddress"`
}

// ClusterStats reports cluster resource usage and consensus state.
type ClusterStats struct {
	ClusterName     string            `json:"clusterName"`
	TotalRamMb      int64             `json:"totalRamMb"`
	AllocatedRamMb  int64             `json:"allocatedRamMb"`
	AvailableRamMb  int64             `json:"availableRamMb"`
	TotalCpuCores   float64           `json:"totalCpuCores"`
	AllocatedCpu    float64           `json:"allocatedCpu"`
	ActivePods      int               `json:"activePods"`
	TotalTxs        uint64            `json:"totalTxs"`
	MerkleRoot      string            `json:"merkleRoot"`
	ConsensusLeader string            `json:"consensusLeader"`
	Nodes           []ClusterNodeInfo `json:"nodes"`
}

// ClusterNodeInfo represents an individual Raspberry Pi node in the cluster.
type ClusterNodeInfo struct {
	Name       string  `json:"name"`
	Role       string  `json:"role"` // "Leader", "Follower"
	Status     string  `json:"status"` // "Ready", "Degraded", "Offline"
	IP         string  `json:"ip"`
	TotalRamMb int64   `json:"totalRamMb"`
	UsedRamMb  int64   `json:"usedRamMb"`
	CpuUsage   float64 `json:"cpuUsagePercent"`
}
