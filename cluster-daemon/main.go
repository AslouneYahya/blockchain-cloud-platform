package main

import (
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"cluster-daemon/pkg/api"
	"cluster-daemon/pkg/consensus"
	"cluster-daemon/pkg/contract"
	"cluster-daemon/pkg/k3s"
	"cluster-daemon/pkg/ledger"
)

//go:embed all:dist
var frontendFS embed.FS

// serveSPA handles client-side React SPA routing and static assets
func serveSPA(distFS fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(distFS))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			f, err := distFS.Open("index.html")
			if err == nil {
				defer f.Close()
				http.ServeContent(w, r, "index.html", time.Now(), f.(io.ReadSeeker))
				return
			}
		}

		f, err := distFS.Open(path)
		if err != nil {
			// SPA fallback: return index.html for React Router
			idx, err := distFS.Open("index.html")
			if err == nil {
				defer idx.Close()
				http.ServeContent(w, r, "index.html", time.Now(), idx.(io.ReadSeeker))
				return
			}
			http.NotFound(w, r)
			return
		}
		f.Close()
		fileServer.ServeHTTP(w, r)
	})
}

// corsMiddleware wraps handlers to allow frontend access
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Wallet-Address, X-Signature")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	immudbHost := os.Getenv("IMMUDB_HOST")
	if immudbHost == "" {
		immudbHost = "immudb"
	}
	immudbPortStr := os.Getenv("IMMUDB_PORT")
	immudbPort := 3322
	if p, err := strconv.Atoi(immudbPortStr); err == nil {
		immudbPort = p
	}

	namespace := os.Getenv("K3S_NAMESPACE")
	if namespace == "" {
		namespace = "default"
	}

	clusterDomain := os.Getenv("CLUSTER_DOMAIN")
	if clusterDomain == "" {
		clusterDomain = "cluster.local"
	}

	totalRamMbStr := os.Getenv("CLUSTER_TOTAL_RAM_MB")
	var totalRamMb int64 = 12288 // 12GB default for 3 Raspberry Pis (4GB each)
	if r, err := strconv.ParseInt(totalRamMbStr, 10, 64); err == nil {
		totalRamMb = r
	}

	allowlistOnly := strings.ToLower(os.Getenv("ALLOWLIST_ONLY")) == "true"

	log.Println("==================================================================")
	log.Println(" Starting Blockchain Infrastructure Engine (Go Cluster Daemon)    ")
	log.Println("==================================================================")
	log.Printf("• Port:            %s", port)
	log.Printf("• Total RAM Cap:   %d MB", totalRamMb)
	log.Printf("• Data Directory:  %s", dataDir)
	log.Printf("• immudb Target:   %s:%d", immudbHost, immudbPort)
	log.Printf("• K3s Namespace:   %s", namespace)
	log.Printf("• Cluster Domain:  %s", clusterDomain)

	// Step 2: Initialize Smart Contract Gatekeeper
	gatekeeper := contract.NewGatekeeper(totalRamMb, allowlistOnly)

	// Optional initial allowed wallet
	adminWallet := os.Getenv("ADMIN_WALLET")
	if adminWallet != "" {
		gatekeeper.AddAllowedWallet(adminWallet)
		log.Printf("• Admin Wallet:    %s", adminWallet)
	}

	// Step 3: Initialize Raft Consensus Engine across Raspberry Pis
	raftConsensus := consensus.NewRaftEngine()

	// Step 4: Initialize immudb Cryptographic Ledger & Merkle Tree
	immudbLedger, err := ledger.NewImmudbLedger(dataDir, immudbHost, immudbPort)
	if err != nil {
		log.Fatalf("Fatal: failed to initialize immudb ledger: %v", err)
	}

	// Step 5: Initialize K3s client-go Orchestrator
	orchestrator := k3s.NewOrchestrator(namespace, clusterDomain)

	server := api.NewServer(gatekeeper, raftConsensus, immudbLedger, orchestrator)

	mux := http.NewServeMux()

	// Deployments & Lifecycle
	mux.HandleFunc("/api/deployments", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			server.HandleDeploy(w, r)
		} else {
			server.HandleGetDeployments(w, r)
		}
	})
	mux.HandleFunc("/api/deployments/", server.HandleDeploymentItem)

	// Backwards compatibility for legacy frontend routes
	mux.HandleFunc("/api/vms", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			server.HandleDeploy(w, r)
		} else {
			server.HandleGetDeployments(w, r)
		}
	})
	mux.HandleFunc("/api/vms/", server.HandleDeploymentItem)

	// immudb Ledger & Merkle Verification
	mux.HandleFunc("/api/ledger", server.HandleLedger)
	mux.HandleFunc("/api/ledger/audit", server.HandleLedgerAudit)
	mux.HandleFunc("/api/ledger/simulate-tamper", server.HandleSimulateTamper)

	// Cluster Health & Hardware Stats
	mux.HandleFunc("/api/cluster/stats", server.HandleClusterStats)
	mux.HandleFunc("/api/cluster/nodes", func(w http.ResponseWriter, r *http.Request) {
		server.HandleClusterStats(w, r)
	})

	// Decentralized Auth check
	mux.HandleFunc("/api/auth/me", server.HandleAuthMe)
	mux.HandleFunc("/api/auth/login", server.HandleAuthMe)

	// Health check
	mux.HandleFunc("/api/health", server.HandleHealth)
	mux.HandleFunc("/health", server.HandleHealth)

	// Embed and serve React Frontend SPA at root
	distSub, err := fs.Sub(frontendFS, "dist")
	if err == nil {
		mux.Handle("/", serveSPA(distSub))
		log.Println("[Frontend] Embedded React Web Console ready at /")
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[Daemon Ready] Listening for signed Web3 transactions on %s\n", addr)

	if err := http.ListenAndServe(addr, corsMiddleware(mux)); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}
