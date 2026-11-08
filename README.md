# INPT Blockchain Cloud Platform — Ledger-Driven Infrastructure Engine

> Cette architecture transforme votre matériel (cluster de Raspberry Pis) en un moteur cohérent où chaque modification d'infrastructure est traitée exactement comme une transaction financière sur une blockchain.

---

## ⛓️ Les 5 Étapes Sous le Capot (Architecture Technique)

```mermaid
flowchart TD
    A["1. Le Client Web3<br/>(Navigateur / React + ethers.js)"] -->|"Payload JSON + Signature secp256k1"| B["2. Le Smart Contract<br/>(Démon Go & ecrecover)"]
    B -->|"Vérification Quota RAM & Règles"| C["3. Le Consensus Raft<br/>(Quorum HA entre Raspberry Pis)"]
    C -->|"Accord Majoritaire (2/3 Pis)"| D["4. Le Registre immudb<br/>(Arbre de Merkle & SHA-256 Chaining)"|
    D -->|"Reçu Transactionnel Immuable"| E["5. L'Orchestration K3s<br/>(client-go Manifests & Pod sur Pi)"]
```

### 1. The Request (Client-Side Cryptography)
Au lieu qu'un utilisateur se connecte avec email/mot de passe pour obtenir un JWT, l'authentification est totalement décentralisée.
* **L'Action :** L'utilisateur configure son déploiement depuis le dashboard React (ex : conteneur Python Backend avec 512 Mo de RAM).
* **L'Exécution Technique :** Le frontend formate cette requête en un objet JSON structuré et canonique. À l'aide de MetaMask ou d'une paire de clés locale `secp256k1`, l'utilisateur signe ce payload JSON avec sa **Clé Privée**.
* **Le Payload :** Le frontend envoie une requête HTTP `POST /api/deployments` contenant le JSON brut *et* la signature cryptographique (`0x...`).

### 2. The Smart Contract (Go Daemon Validation)
Comme `immudb` est un registre immuable et non un moteur de calcul, un programme déterministe agit comme "Smart Contract" : le **démon Go** tournant sur le cluster.
* **Validation de l'Authentification :** Le démon Go reçoit le payload et utilise la cryptographie sur courbes elliptiques (`ecrecover` / `crypto.SigToPub`) pour retrouver l'adresse de wallet publique du signataire sans aucune base de données centrale.
* **Validation de la Logique Métier :** Le démon Go agit en gardien du cluster : l'utilisateur a-t-il la permission de déployer ? Y a-t-il assez de RAM disponible sur l'ensemble du cluster K3s (capacité physique des Raspberry Pis) ?
* **Le Transfert :** Si les règles sont respectées, le démon ne déploie pas encore le conteneur : il prépare la transaction pour le consensus et `immudb`.

### 3. The Consensus (Raft Agreement)
Le système devient décentralisé : `immudb` et le cluster tournent en mode Haute Disponibilité (HA) sur vos Raspberry Pis.
* **La Proposition :** Le démon Go envoie la transaction de déploiement au nœud leader (`pi-node-01`).
* **Le Vote :** Le leader diffuse cette transaction aux nœuds suiveurs (`pi-node-02`, `pi-node-03`) via l'algorithme de consensus **Raft**.
* **Le Quorum :** Chaque Raspberry Pi vérifie son état local (absence de conflit). Dès qu'une majorité (2 sur 3 Pis) vote "Oui", la transaction est officiellement approuvée.

### 4. The Ledger (Cryptographic Hash - immudb)
Une fois le consensus atteint, la transaction est verrouillée de manière permanente.
* **L'Arbre de Merkle :** `immudb` calcule le hash SHA-256 du payload JSON approuvé.
* **La Chaîne de Blocs :** Ce hash est combiné mathématiquement avec le hash de l'état précédent du cluster :
  $$H_n = \text{SHA256}(H_{n-1} + \text{TxID} + \text{Signer} + \text{PayloadHash})$$
* **L'Inviolabilité :** Si un administrateur se connecte en SSH sur une Pi et tente de falsifier un enregistrement, les preuves de Merkle et la chaîne se brisent immédiatement (`VerifyAuditTrail` détecte l'altération instantanément).

### 5. The Infrastructure (K3s Orchestration)
La transaction est vérifiée, acceptée et scellée. Le matériel physique exécute l'ordre.
* **Le Déclencheur :** Le démon Go reçoit la confirmation de commit d'`immudb`.
* **La Traduction :** Le démon Go utilise la bibliothèque officielle Kubernetes (`client-go`) pour traduire le JSON en manifests Kubernetes (`apps/v1 Deployment`, `v1 Service`, `networking.k8s.io/v1 Ingress`).
* **Le Déploiement :** Les instructions sont appliquées au serveur API K3s. K3s tire l'image, planifie le pod sur un Raspberry Pi disponible, configure le réseau interne et configure le routage Ingress (Traefik).

---

## 📸 Aperçu & Captures d'écran

### 1. Authentification Web3 Décentralisée
Connexion sécurisée par portefeuille Web3 (MetaMask ou paire de clés `secp256k1` locale pour le dev).

![Page de connexion](screenshots/login-page.png)

---

### 2. Tableau de Bord Matériel & Registre
Suivi des pods K3s, des nœuds Raspberry Pi et de la racine de Merkle active d'immudb.

![Tableau de bord](screenshots/dashboard-view.png)

---

### 3. Contrôle Matériel & Rollback (Anti-OOM)
Le Smart Contract vérifie les limites physiques des Raspberry Pis avant d'accepter toute transaction.

![Gestion d'erreur et Rollback](screenshots/test-error%20deploiement.png)

---

## 🛠️ Stack Technique

* **Démon Cluster & Smart Contract :** Go 1.24+ (`client-go`, `go-ethereum/crypto`, `crypto/sha256`)
* **Registre Immuable :** immudb (Merkle Tree, SHA-256 state chaining, détection d'altération)
* **Consensus Distribué :** Algorithme Raft (Quorum majoritaire 2/3 sur Raspberry Pis)
* **Orchestration Physique :** K3s (Lightweight Kubernetes pour ARM64 / Raspberry Pi) & Ingress Traefik
* **Interface Utilisateur :** React 18, Vite, Ethers.js
* **Passerelle Réseau :** Nginx Alpine Reverse Proxy

---

## 🚀 Démarrage Rapide

### 1. Lancer l'infrastructure complète avec Docker Compose
```bash
docker compose up -d --build
```
L'application est disponible sur : **`https://localhost`** (ou `http://localhost:5173` en dev).

### 2. Lancer et tester le Démon Go localement
```bash
cd cluster-daemon
go test -v ./...
go run main.go
```

### 3. Lancer le Frontend React en mode Développement
```bash
cd frontend
npm install
npm run dev
```

---

## 📡 Endpoints API du Démon Cluster

| Méthode | Route | Description | Validation |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/deployments` | Pipeline complet en 5 étapes (Signature $\to$ Contrat $\to$ Raft $\to$ immudb $\to$ K3s) | Signature `secp256k1` |
| `GET` | `/api/deployments` | Liste des conteneurs K3s actifs et leur statut matériel | Public |
| `GET` | `/api/deployments/{id}` | Détails d'un pod spécifique | Public |
| `GET` | `/api/deployments/{id}/manifest` | Manifest YAML Kubernetes généré via `client-go` | Public |
| `GET` | `/api/deployments/{id}/logs` | Journaux d'exécution en direct | Public |
| `POST` | `/api/deployments/{id}/exec` | Exécution de commandes dans le conteneur | Public |
| `DELETE` | `/api/deployments/{id}` | Suppression sur K3s et enregistrement de résiliation dans immudb | Signé |
| `GET` | `/api/ledger` | Historique immuable immudb avec blocs et racine de Merkle | Public |
| `GET` | `/api/ledger/audit` | Vérification cryptographique d'intégrité de bout en bout | Public |
| `POST` | `/api/ledger/simulate-tamper` | Simulation d'altération par un admin malveillant pour tester la détection | Dev |
| `GET` | `/api/cluster/stats` | Télémétrie hardware (RAM, CPU, Quorum Raft, Leader) | Public |
| `GET` | `/api/auth/me` | Vérification de l'identité du wallet connecté | Header `X-Wallet-Address` |
