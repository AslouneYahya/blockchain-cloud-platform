# Blockchain-Driven Cloud Infrastructure — Architecture & Technical Diagrams

This document contains the complete architectural, cryptographic, and operational diagrams for the **ChainOps Blockchain Cloud Platform**, deployed on a 3-node physical Raspberry Pi cluster with K3s and immudb.

All diagrams are written in **Mermaid** and render automatically in GitHub, VS Code, and Markdown viewers.

---

## Table of Contents
1. [End-to-End System Topology (Physical Hardware & Cloudflare Edge)](#1-end-to-end-system-topology)
2. [The 5-Step Blockchain Execution Pipeline](#2-the-5-step-blockchain-execution-pipeline)
3. [Smart Contract Gatekeeper vs. Raft Consensus Voting](#3-smart-contract-gatekeeper-vs-raft-consensus-voting)
4. [immudb SHA-256 State Chaining & Merkle Tree Integrity](#4-immudb-sha-256-state-chaining--merkle-tree-integrity)
5. [Tamper Detection & Audit Verification Workflow](#5-tamper-detection--audit-verification-workflow)
6. [Go Cluster Daemon Internal Package Architecture](#6-go-cluster-daemon-internal-package-architecture)
7. [Raft Quorum Voting & Fault Tolerance Scenarios](#7-raft-quorum-voting--fault-tolerance-scenarios)
8. [Workload Lifecycle State Machine](#8-workload-lifecycle-state-machine)
9. [Network Routing & Ingress Flow](#9-network-routing--ingress-flow)
10. [Data Model & Ledger Transaction Schema (ERD)](#10-data-model--ledger-transaction-schema)

---

## 1. End-to-End System Topology

```mermaid
graph TD
    subgraph Client["Client Tier"]
        Dev["Developer / Operator"]
        MM["MetaMask / secp256k1 Wallet"]
        ReactUI["React Web3 Dashboard (Port 5173 / 443)"]
        Dev --> MM
        Dev --> ReactUI
    end

    subgraph Edge["Cloudflare Zero-Trust Edge Tier"]
        CF_API["bc.aslouneyahya.com (HTTPS :443)"]
        CF_K3S["k3s.aslouneyahya.com (HTTPS :443)"]
    end

    ReactUI -->|Signed EIP-191 JSON| CF_API

    subgraph Master["Raspberry Pi Master Node (pi-node-01 — 192.168.1.101)"]
        Cloudflared["cloudflared tunnel daemon"]
        Daemon["ChainOps Go Daemon (:8080)"]
        Immudb["immudb Immutable Ledger (:3322)"]
        K3sServer["K3s Control Plane Server (:6443)"]
        LocalStorage["/var/lib/immudb (Merkle Root Store)"]

        CF_API --> Cloudflared
        CF_K3S --> Cloudflared
        Cloudflared -->|localhost:8080| Daemon
        Cloudflared -->|localhost:6443| K3sServer
        Daemon -->|TCP :3322| Immudb
        Daemon -->|client-go API| K3sServer
        Immudb --> LocalStorage
    end

    subgraph Workers["Raspberry Pi Worker Nodes"]
        Worker1["pi-node-02 (Compute Node — 192.168.1.102)<br/>k3s-agent daemon"]
        Worker2["pi-node-03 (Compute Node — 192.168.1.103)<br/>k3s-agent daemon"]

        K3sServer -.->|K3s WireGuard Tunnel| Worker1
        K3sServer -.->|K3s WireGuard Tunnel| Worker2
    end
```

---

## 2. The 5-Step Blockchain Execution Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (MetaMask)
    participant UI as Web3 Dashboard
    participant Verifier as Step 1 & 2: Crypto & Smart Contract
    participant Raft as Step 3: Raft Consensus Quorum
    participant Immudb as Step 4: immudb Merkle Ledger
    participant K3s as Step 5: K3s Hardware Scheduler

    Dev->>UI: Inputs parameters: name, image, 512 MB RAM, port 80
    UI->>Dev: Prompts personal_sign (Keccak-256 + secp256k1)
    Dev-->>UI: Returns cryptographic signature (0xabcd...)

    UI->>Verifier: POST /api/deployments (Payload + Signature + Address)

    Note over Verifier: Step 2.1: ecrecover(Hash(Payload), Sig)
    Verifier->>Verifier: Mathematically recovers signer public key
    Note over Verifier: Step 2.2: Deterministic Smart Contract Rules
    Verifier->>Verifier: Checks: (Allocated RAM + 512MB) <= 12288MB Cluster Cap

    Verifier->>Raft: ProposeAndAgree(PayloadHash, SignerAddress)
    Note over Raft: Step 3: Leader broadcasts proposal to Worker Pis
    par Quorum Voting Across Pis
        Raft->>Raft: pi-node-01 (Leader): Votes YES (Signs voteHash)
    and
        Raft->>Raft: pi-node-02 (Follower): Votes YES (Signs voteHash)
    and
        Raft->>Raft: pi-node-03 (Follower): Votes YES (Signs voteHash)
    end
    Note over Raft: Quorum Check: 3/3 >= Majority Quorum (2 of 3)

    Raft->>Immudb: CommitTransaction(Payload, ConsensusReceipt)
    Note over Immudb: Step 4: Computes SHA-256 BlockHash & recalculates Merkle Root
    Immudb-->>Verifier: Tx #1 Receipt (BlockHash, MerkleRoot)

    Verifier->>K3s: Deploy(client-go generated YAML manifests)
    Note over K3s: Step 5: Manifest applied to K3s cluster
    K3s->>K3s: Schedules pod on Raspberry Pi node
    K3s-->>UI: 201 Created (Pod Running & Traefik Ingress Active)
```

---

## 3. Smart Contract Gatekeeper vs. Raft Consensus Voting

```mermaid
flowchart TD
    TX["Incoming Signed Transaction: POST /api/deployments"] --> SC_CHECK{"Step 2: Smart Contract Gatekeeper<br/>(Law Enforcement)"}

    SC_CHECK -- "Invalid signature (ecrecover mismatch)" --> REJECT1["❌ 401 Unauthorized: Signature Forged"]
    SC_CHECK -- "Requested RAM > 2048 MB single container cap" --> REJECT2["❌ 403 Forbidden: Container Quota Exceeded"]
    SC_CHECK -- "Allocated RAM + Requested RAM > 12288 MB cluster cap" --> REJECT3["❌ 403 Forbidden: Cluster Capacity Saturated"]
    SC_CHECK -- "Invalid DNS-1123 workload name" --> REJECT4["❌ 400 Bad Request: Invalid Kubernetes Name"]

    SC_CHECK -- "✅ All Smart Contract Rules Approved" --> RAFT_VOTE{"Step 3: Raft Consensus Engine<br/>(Distributed Agreement)"}

    subgraph ConsensusMesh["Raft 3-Node Quorum Mesh"]
        N1["pi-node-01 (Leader)<br/>State: Local check passed"]
        N2["pi-node-02 (Follower)<br/>State: Local check passed"]
        N3["pi-node-03 (Follower)<br/>State: Local check passed"]
    end

    RAFT_VOTE --> ConsensusMesh
    N1 -->|Vote: YES| Q_CHECK{"Quorum Counter"}
    N2 -->|Vote: YES| Q_CHECK
    N3 -->|Vote: YES| Q_CHECK

    Q_CHECK -- "Votes < 2 (Network Split / Pi Down)" --> REJECT5["❌ 503 Service Unavailable: Quorum Failed"]
    Q_CHECK -- "Votes >= 2 (Majority 2/3)" --> APPROVE["✅ Step 4 & 5: Commit to immudb & Schedule Pod"]
```

---

## 4. immudb SHA-256 State Chaining & Merkle Tree Integrity

```mermaid
graph TD
    subgraph HashChain["Cryptographic Hash Chaining"]
        Genesis["Genesis State<br/>Hash: 0x0000..."]

        subgraph Tx1["Transaction #1 (DEPLOY python-api)"]
            H1["Payload Hash: 0xb737..."]
            P1["Previous Hash: 0x0000..."]
            BH1["Block Hash #1 = SHA256(P1 + H1 + TxID + Timestamp)"]
        end

        subgraph Tx2["Transaction #2 (DEPLOY nginx-web)"]
            H2["Payload Hash: 0x69ff..."]
            P2["Previous Hash = Block Hash #1"]
            BH2["Block Hash #2 = SHA256(P2 + H2 + TxID + Timestamp)"]
        end

        subgraph Tx3["Transaction #3 (TERMINATE nginx-web)"]
            H3["Payload Hash: 0x9121..."]
            P3["Previous Hash = Block Hash #2"]
            BH3["Block Hash #3 = SHA256(P3 + H3 + TxID + Timestamp)"]
        end

        Genesis --> Tx1
        BH1 --> P2
        Tx1 --> Tx2
        BH2 --> P3
        Tx2 --> Tx3
    end

    subgraph MerkleTree["Tamper-Proof Merkle Tree Root"]
        Leaf1["Leaf 1: BlockHash #1"]
        Leaf2["Leaf 2: BlockHash #2"]
        Leaf3["Leaf 3: BlockHash #3"]
        Leaf4["Leaf 4: BlockHash #3 (Balanced)"]

        Parent1["Parent Node 1 = SHA256(Leaf1 + Leaf2)"]
        Parent2["Parent Node 2 = SHA256(Leaf3 + Leaf4)"]

        Root["🌳 Merkle Root = SHA256(Parent1 + Parent2)<br/>(0x471100021de1...)"]

        Leaf1 --> Parent1
        Leaf2 --> Parent1
        Leaf3 --> Parent2
        Leaf4 --> Parent2
        Parent1 --> Root
        Parent2 --> Root
    end

    BH1 -.-> Leaf1
    BH2 -.-> Leaf2
    BH3 -.-> Leaf3
```

---

## 5. Tamper Detection & Audit Verification Workflow

```mermaid
flowchart TD
    AuditStart["Audit Request: GET /api/ledger/audit"] --> FetchChain["Fetch all blocks sequentially from immudb"]
    
    FetchChain --> Step1["For block i = 1 to N:"]
    Step1 --> CheckPrev{"Does block[i].PreviousHash == block[i-1].BlockHash?"}

    CheckPrev -- "No (Hash Chain Broken)" --> BrokenDetected["❌ TAMPER DETECTED<br/>Hash mismatch at Tx #i"]
    
    CheckPrev -- "Yes" --> CheckHash{"Recompute BlockHash[i]:<br/>Does recomputed == stored?"}

    CheckHash -- "No (Payload altered)" --> BrokenDetected
    
    CheckHash -- "Yes" --> NextBlock["Proceed to next block in chain"]
    NextBlock --> Step1

    NextBlock -- "All blocks verified" --> CheckRoot{"Rebuild Merkle Tree from all leaves:<br/>Does calculated root == stored Merkle Root?"}

    CheckRoot -- "No (Root Tampered)" --> BrokenDetected
    CheckRoot -- "Yes" --> AuditSuccess["✅ 100% Cryptographic Integrity Verified<br/>0 Tampering Detected"]
```

---

## 6. Go Cluster Daemon Internal Package Architecture

```mermaid
graph TB
    subgraph APILayer["pkg/api (REST Endpoints)"]
        Server["Server struct"]
        H_Deploy["HandleDeploy (/api/deployments)"]
        H_List["HandleGetDeployments (/api/deployments)"]
        H_Item["HandleDeploymentItem (/api/deployments/:id)"]
        H_Audit["HandleLedgerAudit (/api/ledger/audit)"]
        H_Stats["HandleClusterStats (/api/cluster/stats)"]
        H_Health["HandleHealth (/api/health)"]

        Server --> H_Deploy
        Server --> H_List
        Server --> H_Item
        Server --> H_Audit
        Server --> H_Stats
        Server --> H_Health
    end

    subgraph CoreEngines["Core Blockchain Packages"]
        Crypto["pkg/crypto<br/>• VerifyEthereumSignature<br/>• ecrecover<br/>• PrefixedPersonalSignHash"]
        Contract["pkg/contract<br/>• SmartContractGatekeeper<br/>• ValidateRules<br/>• RAM/CPU Budget Check"]
        Consensus["pkg/consensus<br/>• RaftEngine<br/>• ProposeAndAgree<br/>• 3-Node Quorum Voting"]
        Ledger["pkg/ledger<br/>• ImmudbLedger<br/>• CommitTransaction<br/>• VerifyAuditTrail<br/>• Merkle Tree Engine"]
        Orchestrator["pkg/k3s<br/>• Orchestrator<br/>• client-go Manifest Builder<br/>• Pod Scheduling & Exec"]
    end

    H_Deploy --> Crypto
    H_Deploy --> Contract
    H_Deploy --> Consensus
    H_Deploy --> Ledger
    H_Deploy --> Orchestrator
    H_Audit --> Ledger
    H_Stats --> Consensus
    H_Stats --> Orchestrator
```

---

## 7. Raft Quorum Voting & Fault Tolerance Scenarios

```mermaid
flowchart TD
    subgraph ScenarioA["Scenario A: Healthy Cluster (3/3 Nodes Online)"]
        A_Leader["pi-node-01 (Leader): VOTE YES"]
        A_W1["pi-node-02 (Follower): VOTE YES"]
        A_W2["pi-node-03 (Follower): VOTE YES"]
        A_Leader & A_W1 & A_W2 --> A_Result["3/3 Positive Votes (Quorum Reached ✅)<br/>Transaction Approved"]
    end

    subgraph ScenarioB["Scenario B: 1 Worker Pi Crashes / Power Loss (2/3 Online)"]
        B_Leader["pi-node-01 (Leader): VOTE YES"]
        B_W1["pi-node-02 (Follower): VOTE YES"]
        B_W2["pi-node-03 (CRASHED / OFFLINE): NO VOTE"]
        B_Leader & B_W1 & B_W2 --> B_Result["2/3 Positive Votes (Majority Quorum >= 2 ✅)<br/>High Availability Maintained!"]
    end

    subgraph ScenarioC["Scenario C: Network Partition / 2 Pis Offline (1/3 Online)"]
        C_Leader["pi-node-01 (Leader): VOTE YES"]
        C_W1["pi-node-02 (OFFLINE): NO VOTE"]
        C_W2["pi-node-03 (OFFLINE): NO VOTE"]
        C_Leader & C_W1 & C_W2 --> C_Result["1/3 Positive Votes (Quorum Failed ❌)<br/>Cluster Enters Safe Mode to Prevent Split-Brain"]
    end
```

---

## 8. Workload Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> FormInput : Developer configures workload
    FormInput --> SignedByWallet : MetaMask signs JSON (EIP-191)
    
    SignedByWallet --> SmartContractValidation : Dispatched to Go Daemon
    
    SmartContractValidation --> Rejected : Signature invalid OR RAM cap exceeded
    Rejected --> [*]
    
    SmartContractValidation --> RaftConsensusVoting : Rules passed
    
    RaftConsensusVoting --> ConsensusFailed : Quorum not reached (< 2 Pis)
    ConsensusFailed --> [*]
    
    RaftConsensusVoting --> LedgerCommitted : Quorum reached (>= 2/3 Pis)
    
    LedgerCommitted --> ManifestGenerated : immudb generates BlockHash & Merkle Root
    
    ManifestGenerated --> PodRunning : K3s client-go schedules pod on Raspberry Pi
    
    PodRunning --> ExecutingCommands : Web3 In-Pod Exec Shell (uname, logs)
    ExecutingCommands --> PodRunning
    
    PodRunning --> Terminating : Signed DELETE request issued
    Terminating --> LedgerRecorded : immudb records Tx (type: TERMINATE)
    LedgerRecorded --> [*] : Resources reclaimed by Smart Contract
```

---

## 9. Network Routing & Ingress Flow

```mermaid
graph LR
    subgraph External["Public Internet"]
        Browser["User Browser"]
    end

    subgraph CloudflareEdge["Cloudflare Edge Network"]
        CF_Dns["Cloudflare DNS & SSL Termination"]
        CF_Tunnel["Cloudflare Edge Tunnel Connector"]
        CF_Dns --> CF_Tunnel
    end

    Browser -->|https://bc.aslouneyahya.com| CF_Dns
    Browser -->|https://k3s.aslouneyahya.com| CF_Dns

    subgraph MasterHardware["Raspberry Pi Master Hardware"]
        TunnelDaemon["cloudflared process"]
        GoAPI["Go Daemon (:8080)"]
        K3sAPI["K3s API Server (:6443)"]
        Traefik["Traefik Ingress Controller (:80)"]
        Pod1["Pod: python-backend (10.42.10.52:8000)"]

        CF_Tunnel -->|Encrypted Tunnel| TunnelDaemon
        TunnelDaemon -->|HTTP :8080| GoAPI
        TunnelDaemon -->|HTTPS :6443| K3sAPI
        GoAPI -.->|client-go API| K3sAPI
        K3sAPI -.->|Routes Traffic| Traefik
        Traefik -->|Internal Pod IP| Pod1
    end
```

---

## 10. Data Model & Ledger Transaction Schema

```mermaid
erDiagram
    SignedDeploymentRequest ||--|| DeploymentPayload : contains
    SignedDeploymentRequest {
        string signerAddress
        string signature
        string rawPayload
    }

    DeploymentPayload {
        string name
        string image
        int64 ramMb
        float64 cpu
        int port
        int replicas
        int64 timestamp
        string nonce
    }

    LedgerTransaction ||--|| DeploymentPayload : stores
    LedgerTransaction ||--|| ConsensusReceipt : proves
    LedgerTransaction {
        uint64 txId PK
        timestamp timestamp
        string type "DEPLOY or TERMINATE"
        string signerAddress
        string payloadHash "SHA-256"
        string previousHash "SHA-256"
        string blockHash "SHA-256"
        string merkleRoot "SHA-256"
        string signature "secp256k1"
    }

    ConsensusReceipt ||--|{ ConsensusVote : aggregates
    ConsensusReceipt {
        int64 term
        string leaderNode
        int totalNodes
        int positiveVotes
        bool quorumReached
    }

    ConsensusVote {
        string nodeId
        bool vote
        string reason
        timestamp votedAt
        string signature "node SHA-256 voteHash"
    }

    LedgerTransaction ||--|| K3sDeploymentStatus : schedules
    K3sDeploymentStatus {
        string deploymentId PK
        string name
        string namespace
        string phase "Running or Terminated"
        string nodeAssigned "pi-node-01"
        string internalIp "10.42.x.x"
        string ingressUrl
    }
```
