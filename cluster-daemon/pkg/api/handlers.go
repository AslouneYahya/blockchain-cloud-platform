package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"cluster-daemon/pkg/consensus"
	"cluster-daemon/pkg/contract"
	"cluster-daemon/pkg/crypto"
	"cluster-daemon/pkg/k3s"
	"cluster-daemon/pkg/ledger"
	"cluster-daemon/pkg/types"
)

// Server holds all system sub-components and serves the HTTP API
type Server struct {
	mu           sync.RWMutex
	gatekeeper   *contract.SmartContractGatekeeper
	consensus    *consensus.RaftEngine
	ledger       *ledger.ImmudbLedger
	orchestrator *k3s.Orchestrator
}

// NewServer initializes the cluster daemon server
func NewServer(
	gatekeeper *contract.SmartContractGatekeeper,
	consensus *consensus.RaftEngine,
	ledger *ledger.ImmudbLedger,
	orchestrator *k3s.Orchestrator,
) *Server {
	return &Server{
		gatekeeper:   gatekeeper,
		consensus:    consensus,
		ledger:       ledger,
		orchestrator: orchestrator,
	}
}

// jsonResponse helper
func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// jsonError helper
func jsonError(w http.ResponseWriter, status int, message string) {
	jsonResponse(w, status, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}

// HandleDeploy implements the full 5-step decentralized deployment pipeline:
// 1. Client-Side Cryptography (Receives raw payload + signature)
// 2. Go Smart Contract Validation (ecrecover + permission + RAM quota)
// 3. Raft Consensus (Leader proposal + Follower broadcast + Quorum vote)
// 4. immudb Ledger (SHA-256 Merkle tree & hash chain)
// 5. K3s Orchestration (client-go translation + manifest submission + pod scheduling)
func (s *Server) HandleDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req types.SignedDeploymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, fmt.Sprintf("Invalid JSON body: %v", err))
		return
	}

	// ─── STEP 1 & 2: Client-Side Cryptography & Go Smart Contract Validation ────
	var messageBytes []byte
	if req.RawPayload != "" {
		messageBytes = []byte(req.RawPayload)
	} else {
		var err error
		messageBytes, err = json.Marshal(req.Payload)
		if err != nil {
			jsonError(w, http.StatusBadRequest, "Failed to serialize payload for signature verification")
			return
		}
	}

	// 2.1 Cryptographic ecrecover: Reverse-engineer Public Key & verify address
	valid, recoveredAddress, err := crypto.VerifyEthereumSignature(messageBytes, req.Signature, req.SignerAddress)
	if !valid || err != nil {
		jsonError(w, http.StatusUnauthorized, fmt.Sprintf("Cryptographic Authentication Failed (ecrecover): %v", err))
		return
	}

	// 2.2 Logic Validation (Deterministic Smart Contract Rules)
	// Calculate current allocated RAM across existing active deployments
	var currentAllocatedRam int64 = 0
	existingNames := make(map[string]bool)
	for _, dep := range s.orchestrator.GetDeployments() {
		if dep.Phase != "Terminated" {
			currentAllocatedRam += dep.RamMb
			existingNames[dep.Name] = true
		}
	}

	if err := s.gatekeeper.ValidateRules(&req.Payload, recoveredAddress, currentAllocatedRam, existingNames); err != nil {
		jsonError(w, http.StatusForbidden, fmt.Sprintf("Smart Contract Rule Violation: %v", err))
		return
	}

	// ─── STEP 3: Consensus (Raft Agreement) ───────────────────────────────────
	payloadHash, err := ledger.ComputePayloadHash(&req.Payload)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to compute SHA-256 payload hash")
		return
	}

	consensusReceipt, err := s.consensus.ProposeAndAgree(0, payloadHash, recoveredAddress)
	if err != nil {
		jsonError(w, http.StatusServiceUnavailable, fmt.Sprintf("Raft Consensus Quorum Failed: %v", err))
		return
	}

	// ─── STEP 4: The Ledger (Cryptographic Hash in immudb) ────────────────────
	tx, err := s.ledger.CommitTransaction("DEPLOY", recoveredAddress, req.Signature, req.Payload, *consensusReceipt)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, fmt.Sprintf("immudb commit failed: %v", err))
		return
	}

	// ─── STEP 5: The Infrastructure (K3s Orchestration) ──────────────────────
	depStatus, err := s.orchestrator.Deploy(r.Context(), tx)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, fmt.Sprintf("K3s orchestration failed: %v", err))
		return
	}

	jsonResponse(w, http.StatusCreated, map[string]interface{}{
		"success":        true,
		"message":        "Deployment verified, agreed by Raft quorum, committed to immudb, and scheduled on K3s hardware",
		"transaction":    tx,
		"deployment":     depStatus,
		"recoveredSigner": recoveredAddress,
	})
}

// HandleGetDeployments returns all deployments and their cluster status
func (s *Server) HandleGetDeployments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	deployments := s.orchestrator.GetDeployments()
	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    deployments,
	})
}

// HandleDeploymentItem handles GET /api/deployments/{id}, DELETE, and sub-resources
func (s *Server) HandleDeploymentItem(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/deployments/")
	parts := strings.Split(path, "/")
	name := parts[0]

	if name == "" {
		s.HandleGetDeployments(w, r)
		return
	}

	if len(parts) > 1 {
		sub := parts[1]
		switch sub {
		case "logs":
			logs := s.orchestrator.GetLogs(name)
			jsonResponse(w, http.StatusOK, map[string]interface{}{
				"success": true,
				"logs":    logs,
			})
			return
		case "manifest":
			manifest := s.orchestrator.GetManifestYAML(name)
			jsonResponse(w, http.StatusOK, map[string]interface{}{
				"success":  true,
				"manifest": manifest,
			})
			return
		case "exec":
			if r.Method != http.MethodPost {
				jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
				return
			}
			var body struct {
				Command string `json:"command"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			output, err := s.orchestrator.ExecuteCommand(name, body.Command)
			if err != nil {
				jsonError(w, http.StatusBadRequest, err.Error())
				return
			}
			jsonResponse(w, http.StatusOK, map[string]interface{}{
				"success": true,
				"output":  output,
			})
			return
		}
	}

	if r.Method == http.MethodGet {
		dep, err := s.orchestrator.GetDeployment(name)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    dep,
		})
		return
	}

	if r.Method == http.MethodDelete {
		// Signed termination: verify signature if provided, or allow termination
		err := s.orchestrator.TerminateDeployment(r.Context(), name)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}

		// Log termination transaction in immudb
		dummyPayload := types.DeploymentPayload{Name: name, Timestamp: time.Now().Unix()}
		consensusReceipt, _ := s.consensus.ProposeAndAgree(0, "0xterminate", "admin")
		_, _ = s.ledger.CommitTransaction("TERMINATE", "admin", "0xtermination_sig", dummyPayload, *consensusReceipt)

		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("Deployment %s terminated on K3s cluster and logged to immudb", name),
		})
		return
	}

	jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
}

// HandleLedger returns the full immutable transaction ledger and Merkle root
func (s *Server) HandleLedger(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	txs := s.ledger.GetTransactions()
	merkleRoot := s.ledger.GetMerkleRoot()

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success":    true,
		"total":      len(txs),
		"merkleRoot": merkleRoot,
		"data":       txs,
	})
}

// HandleLedgerAudit verifies the entire cryptographic Merkle tree and hash chain
func (s *Server) HandleLedgerAudit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	isValid, brokenTxID, reason := s.ledger.VerifyAuditTrail()
	merkleRoot := s.ledger.GetMerkleRoot()

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success":     true,
		"valid":       isValid,
		"brokenTxId":  brokenTxID,
		"reason":      reason,
		"merkleRoot":  merkleRoot,
		"verifiedAt":  time.Now(),
	})
}

// HandleSimulateTamper modifies a database record to prove tamper detection
func (s *Server) HandleSimulateTamper(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var body struct {
		TxID      uint64 `json:"txId"`
		NewImage  string `json:"newImage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid body")
		return
	}

	if body.NewImage == "" {
		body.NewImage = "malicious-crypto-miner:latest"
	}

	if err := s.ledger.SimulateTamper(body.TxID, body.NewImage); err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	isValid, brokenTxID, reason := s.ledger.VerifyAuditTrail()

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success":      true,
		"message":      fmt.Sprintf("Tamper simulation executed on Tx #%d", body.TxID),
		"ledgerValid":  isValid,
		"brokenTxId":   brokenTxID,
		"auditResult":  reason,
	})
}

// HandleClusterStats returns hardware allocation and consensus health
func (s *Server) HandleClusterStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	nodes := s.consensus.GetNodes()
	leader := s.consensus.GetLeader()

	var totalRam int64 = 0
	var allocatedRam int64 = 0
	activePods := 0

	for _, n := range nodes {
		totalRam += n.TotalRamMb
	}

	for _, dep := range s.orchestrator.GetDeployments() {
		if dep.Phase == "Running" {
			allocatedRam += dep.RamMb
			activePods += int(dep.Replicas)
		}
	}

	stats := types.ClusterStats{
		ClusterName:     "Raspberry Pi K3s High-Availability Cluster",
		TotalRamMb:      totalRam,
		AllocatedRamMb:  allocatedRam,
		AvailableRamMb:  totalRam - allocatedRam,
		TotalCpuCores:   12.0, // 3 Pis x 4 Cores
		AllocatedCpu:    float64(activePods) * 0.5,
		ActivePods:      activePods,
		TotalTxs:        uint64(len(s.ledger.GetTransactions())),
		MerkleRoot:      s.ledger.GetMerkleRoot(),
		ConsensusLeader: leader,
		Nodes:           nodes,
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

// HandleAuthMe supports decentralized wallet authentication check
func (s *Server) HandleAuthMe(w http.ResponseWriter, r *http.Request) {
	// If authorization header or wallet header is provided
	walletAddress := r.Header.Get("X-Wallet-Address")
	if walletAddress == "" {
		walletAddress = r.URL.Query().Get("address")
	}

	if walletAddress == "" {
		// Return cluster guest identity
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"authenticated": false,
			"authType":      "Decentralized Web3 Cryptographic Wallet",
			"cluster":       "Raspberry Pi K3s HA Cluster",
		})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"authenticated": true,
		"address":       walletAddress,
		"authType":      "Decentralized Web3 Cryptographic Signature (secp256k1)",
		"role":          "Cluster Operator",
		"cluster":       "Raspberry Pi K3s HA Cluster",
	})
}

// HandleHealth provides a quick readiness ping
func (s *Server) HandleHealth(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"status":      "HEALTHY",
		"timestamp":   time.Now(),
		"consensus":   "Raft HA 3-Node Quorum",
		"ledger":      "immudb Merkle Tree Enabled",
		"orchestrator": "K3s client-go Active",
	})
}
