package contract

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"

	"cluster-daemon/pkg/types"
)

var (
	dns1123Regex   = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`)
	imageNameRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-\./:]+$`)
)

// SmartContractGatekeeper implements the deterministic validation rules ("Smart Contract")
// running inside the Go daemon on the cluster before any transaction reaches immudb.
type SmartContractGatekeeper struct {
	mu             sync.RWMutex
	maxClusterRam  int64            // Total RAM limit across Raspberry Pi nodes (e.g. 12288 MB for 3x 4GB Pis)
	maxSingleRam   int64            // Max RAM per single container (e.g. 2048 MB)
	minSingleRam   int64            // Min RAM (e.g. 64 MB)
	maxSingleCpu   float64          // Max CPU cores
	allowedWallets map[string]bool  // Optional allowlist (if empty, allows all valid signed wallets)
	allowlistOnly  bool             // If true, only allowedWallets can deploy
}

// NewGatekeeper initializes a smart contract gatekeeper with hardware limits
func NewGatekeeper(totalClusterRamMb int64, allowlistOnly bool) *SmartContractGatekeeper {
	if totalClusterRamMb <= 0 {
		totalClusterRamMb = 12288 // 12GB default (3 Raspberry Pis x 4GB)
	}

	return &SmartContractGatekeeper{
		maxClusterRam:  totalClusterRamMb,
		maxSingleRam:   2048, // 2GB max per container
		minSingleRam:   64,   // 64MB min
		maxSingleCpu:   4.0,
		allowedWallets: make(map[string]bool),
		allowlistOnly:  allowlistOnly,
	}
}

// AddAllowedWallet registers an address authorized to deploy
func (g *SmartContractGatekeeper) AddAllowedWallet(address string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.allowedWallets[strings.ToLower(strings.TrimSpace(address))] = true
}

// ValidateRules executes deterministic smart contract gatekeeping:
// 1. User permission check
// 2. Hardware capacity check (Cluster RAM availability)
// 3. Container specification safety check
func (g *SmartContractGatekeeper) ValidateRules(
	payload *types.DeploymentPayload,
	signerAddress string,
	currentAllocatedRamMb int64,
	existingNames map[string]bool,
) error {
	g.mu.RLock()
	defer g.mu.RUnlock()

	signerLower := strings.ToLower(strings.TrimSpace(signerAddress))

	// 1. Permission Check
	if g.allowlistOnly {
		if !g.allowedWallets[signerLower] {
			return fmt.Errorf("contract violation: wallet %s is not authorized to deploy on this cluster", signerAddress)
		}
	}

	// 2. Deployment Name check (must be valid DNS-1123 label for K3s)
	name := strings.ToLower(strings.TrimSpace(payload.Name))
	if name == "" {
		return errors.New("contract violation: deployment name cannot be empty")
	}
	if len(name) > 63 {
		return errors.New("contract violation: deployment name must not exceed 63 characters")
	}
	if !dns1123Regex.MatchString(name) {
		return fmt.Errorf("contract violation: name '%s' is invalid (must match RFC 1123: lowercase alphanumeric and hyphens)", name)
	}
	if existingNames[name] {
		return fmt.Errorf("contract violation: deployment '%s' already exists in cluster", name)
	}

	// 3. Container Image check
	image := strings.TrimSpace(payload.Image)
	if image == "" {
		return errors.New("contract violation: container image is required")
	}
	if !imageNameRegex.MatchString(image) {
		return fmt.Errorf("contract violation: image name '%s' contains forbidden characters", image)
	}

	// 4. Memory Quota Check (Per-container limits)
	if payload.RamMb < g.minSingleRam {
		return fmt.Errorf("contract violation: requested RAM (%dMB) is below minimum of %dMB", payload.RamMb, g.minSingleRam)
	}
	if payload.RamMb > g.maxSingleRam {
		return fmt.Errorf("contract violation: requested RAM (%dMB) exceeds max container quota of %dMB", payload.RamMb, g.maxSingleRam)
	}

	// 5. Cluster Hardware Capacity Check (Is there enough RAM available across Raspberry Pis?)
	projectedAllocated := currentAllocatedRamMb + payload.RamMb
	if projectedAllocated > g.maxClusterRam {
		return fmt.Errorf("contract violation: insufficient cluster memory! Requested %dMB, but only %dMB is available out of %dMB total hardware capacity",
			payload.RamMb, g.maxClusterRam-currentAllocatedRamMb, g.maxClusterRam)
	}

	// 6. CPU Check
	if payload.Cpu <= 0 {
		payload.Cpu = 0.5 // Default to 0.5 core if unspecified
	}
	if payload.Cpu > g.maxSingleCpu {
		return fmt.Errorf("contract violation: requested CPU (%.1f cores) exceeds max limit of %.1f cores", payload.Cpu, g.maxSingleCpu)
	}

	// 7. Network Port Check
	if payload.Port < 0 || payload.Port > 65535 {
		return fmt.Errorf("contract violation: invalid port %d (must be between 1 and 65535)", payload.Port)
	}
	if payload.Port == 0 {
		payload.Port = 80 // Default HTTP port
	}

	if payload.Replicas <= 0 {
		payload.Replicas = 1
	}

	return nil
}
