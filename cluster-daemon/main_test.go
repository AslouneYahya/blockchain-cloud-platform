package main

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"cluster-daemon/pkg/consensus"
	"cluster-daemon/pkg/contract"
	"cluster-daemon/pkg/crypto"
	"cluster-daemon/pkg/k3s"
	"cluster-daemon/pkg/ledger"
	"cluster-daemon/pkg/types"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

func TestFullFiveStepPipeline(t *testing.T) {
	// ─── STEP 1: Generate Client Keypair & Sign Deployment Payload ──────────
	privateKey, err := ethcrypto.GenerateKey()
	if err != nil {
		t.Fatalf("Failed to generate private key: %v", err)
	}
	signerAddress := ethcrypto.PubkeyToAddress(privateKey.PublicKey).Hex()

	payload := types.DeploymentPayload{
		Name:      "test-python-backend",
		Image:     "python:3.11-alpine",
		RamMb:     512,
		Cpu:       1.0,
		Port:      8000,
		Replicas:  1,
		Timestamp: time.Now().Unix(),
		Nonce:     "nonce-12345",
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Failed to marshal payload: %v", err)
	}

	// Sign payload with client private key (personal_sign)
	msgHash := crypto.PrefixedPersonalSignHash(payloadBytes)
	sigBytes, err := ethcrypto.Sign(msgHash, privateKey)
	if err != nil {
		t.Fatalf("Failed to sign message: %v", err)
	}
	// Add 27 to V to match standard Ethereum RPC format
	sigBytes[64] += 27
	signatureHex := "0x" + ethcrypto.PubkeyToAddress(privateKey.PublicKey).Hex() // just dummy prefix test, use hex
	_ = signatureHex
	sigHex := "0x" + string(ethcrypto.FromECDSA(privateKey)) // not this
	_ = sigHex

	// Hex of sigBytes
	sigHex = "0x"
	for _, b := range sigBytes {
		sigHex += string([]byte{
			"0123456789abcdef"[b>>4],
			"0123456789abcdef"[b&0xf],
		})
	}

	// ─── STEP 2: Smart Contract Go Daemon Validation ────────────────────────
	// 2.1 Ecrecover
	valid, recoveredAddr, err := crypto.VerifyEthereumSignature(payloadBytes, sigHex, signerAddress)
	if !valid || err != nil {
		t.Fatalf("Step 2.1 ecrecover failed: %v", err)
	}
	t.Logf("Step 2.1 ecrecover successfully derived wallet: %s", recoveredAddr)

	// 2.2 Logic rules validation
	gatekeeper := contract.NewGatekeeper(12288, false)
	err = gatekeeper.ValidateRules(&payload, recoveredAddr, 0, map[string]bool{})
	if err != nil {
		t.Fatalf("Step 2.2 Gatekeeper rules failed: %v", err)
	}
	t.Logf("Step 2.2 Smart Contract logic passed: RAM %dMB fits cluster capacity", payload.RamMb)

	// ─── STEP 3: Consensus (Raft Agreement) ─────────────────────────────────
	raft := consensus.NewRaftEngine()
	payloadHash, err := ledger.ComputePayloadHash(&payload)
	if err != nil {
		t.Fatalf("Step 3 Hash computation failed: %v", err)
	}
	consensusReceipt, err := raft.ProposeAndAgree(1, payloadHash, recoveredAddr)
	if err != nil || !consensusReceipt.QuorumReached {
		t.Fatalf("Step 3 Raft consensus failed: %v", err)
	}
	t.Logf("Step 3 Consensus reached: %d/%d nodes voted YES across Raspberry Pis",
		consensusReceipt.PositiveVotes, consensusReceipt.TotalNodes)

	// ─── STEP 4: Ledger (immudb SHA-256 Merkle Chain) ────────────────────────
	tmpDir := t.TempDir()
	immudbLedger, err := ledger.NewImmudbLedger(tmpDir, "localhost", 3322)
	if err != nil {
		t.Fatalf("Failed to init ledger: %v", err)
	}

	tx, err := immudbLedger.CommitTransaction("DEPLOY", recoveredAddr, sigHex, payload, *consensusReceipt)
	if err != nil {
		t.Fatalf("Step 4 commit failed: %v", err)
	}
	t.Logf("Step 4 immudb permanent commit: Tx #%d, BlockHash: %s, MerkleRoot: %s",
		tx.TxID, tx.BlockHash[:16]+"...", tx.MerkleRoot[:16]+"...")

	// Verify cryptographic audit trail
	isClean, brokenTx, reason := immudbLedger.VerifyAuditTrail()
	if !isClean {
		t.Fatalf("Audit trail broken at tx %d: %s", brokenTx, reason)
	}
	t.Logf("Step 4 Cryptographic audit trail: %s", reason)

	// ─── STEP 5: Infrastructure (K3s Orchestration) ──────────────────────────
	orchestrator := k3s.NewOrchestrator("default", "cluster.local")
	depStatus, err := orchestrator.Deploy(context.Background(), tx)
	if err != nil {
		t.Fatalf("Step 5 K3s orchestration failed: %v", err)
	}
	t.Logf("Step 5 Physical deployment active: %s on hardware node %s (Ingress: %s)",
		depStatus.Name, depStatus.NodeAssigned, depStatus.IngressURL)
}
