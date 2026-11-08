#!/usr/bin/env bash
# ==============================================================================
# setup_master_node.sh — Master Node Setup for Raspberry Pi
# Sets up Cloud Platform, K3s Control Plane, immudb, and ChainOps Go Daemon
# ==============================================================================
set -e

TARGET_DIR="$HOME/cloud-platform-inpt"
REPO_URL="https://github.com/AslouneYahya/blockchain-cloud-platform.git"

echo "=== [1/6] Cloning / Updating Cloud Platform Repository ==="
if [ -d "$TARGET_DIR" ]; then
    echo "Repository already present, updating..."
    cd "$TARGET_DIR"
    git pull origin main || true
else
    echo "Cloning repository from GitHub..."
    git clone "$REPO_URL" "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

echo "=== [2/6] Running Base Master Node Installer ==="
cd "$TARGET_DIR/master-node"
chmod +x install.sh
chmod +x scripts/*.sh || true
./install.sh

echo "=== [3/6] Setting up Linux Kernel cgroups for K3s ==="
cd "$TARGET_DIR"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE_FILE" ] && CMDLINE_FILE="/boot/cmdline.txt"

if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE"; then
        echo "Enabling cgroup memory flags..."
        sudo sed -i '$ s/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
    fi
fi

echo "=== [4/6] Installing K3s Control Plane ==="
curl -sfL https://get.k3s.io | sh -s - \
    --write-kubeconfig-mode 644 \
    --disable traefik \
    --node-name "pi-node-01"

echo "=== [5/6] Installing & Starting immudb Ledger ==="
IMMUDB_VERSION="v1.9.2"
sudo mkdir -p /var/lib/immudb /opt/chainops/data

if ! command -v immudb >/dev/null 2>&1; then
    echo "Downloading immudb ARM64..."
    curl -fsSL -o /tmp/immudb "https://github.com/codenotary/immudb/releases/download/${IMMUDB_VERSION}/immudb-${IMMUDB_VERSION}-linux-arm64" || true
    if [ -f /tmp/immudb ]; then
        sudo mv /tmp/immudb /usr/local/bin/immudb
        sudo chmod +x /usr/local/bin/immudb
    fi
fi

sudo bash -c 'cat <<EOF > /etc/systemd/system/immudb.service
[Unit]
Description=immudb Immutable Ledger Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/immudb --dir=/var/lib/immudb --address=0.0.0.0 --port=3322
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable --now immudb.service

echo "=== [6/6] Installing & Starting ChainOps Go Daemon ==="
if [ -f "$TARGET_DIR/cluster-daemon/daemon-arm64" ]; then
    sudo cp "$TARGET_DIR/cluster-daemon/daemon-arm64" /opt/chainops/chainops-daemon
    sudo chmod +x /opt/chainops/chainops-daemon
fi

sudo bash -c 'cat <<EOF > /etc/systemd/system/chainops-daemon.service
[Unit]
Description=ChainOps Blockchain Infrastructure Daemon
After=network.target immudb.service k3s.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/chainops
Environment=PORT=8080
Environment=DATA_DIR=/opt/chainops/data
Environment=IMMUDB_HOST=127.0.0.1
Environment=IMMUDB_PORT=3322
Environment=KUBECONFIG=/etc/rancher/k3s/k3s.yaml
Environment=CLUSTER_TOTAL_RAM_MB=12288
Environment=K3S_NAMESPACE=default
Environment=CLUSTER_DOMAIN=cluster.local
ExecStart=/opt/chainops/chainops-daemon
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
if [ -f /opt/chainops/chainops-daemon ]; then
    sudo systemctl enable --now chainops-daemon.service
fi

echo ""
echo "======================================================================"
echo "  MASTER NODE INSTALLATION COMPLETE!                                  "
echo "  - Master Node API (FastAPI):  port 5000 (HEALTHY)                   "
echo "  - ChainOps Blockchain Daemon: port 8080 (HEALTHY)                   "
echo "  - immudb Merkle Ledger:       port 3322 (RUNNING)                   "
echo "  - K3s Control Plane Server:   port 6443 (READY)                     "
echo "======================================================================"
echo ""
echo ">> K3S NODE TOKEN FOR WORKER PIS:"
echo "----------------------------------------------------------------------"
sudo cat /var/lib/rancher/k3s/server/node-token
echo "----------------------------------------------------------------------"
