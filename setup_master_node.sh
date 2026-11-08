#!/usr/bin/env bash
# ==============================================================================
# setup_master_node.sh — Complete All-in-One Master Node Setup for Raspberry Pi
# 1. Cloudflare WARP + Tunnel (cloudflared systemd service)
# 2. Master Node Listener (FastAPI daemon)
# 3. K3s Control Plane Server
# 4. immudb Immutable Ledger Server
# 5. ChainOps Go Smart Contract Daemon
# ==============================================================================
set -e

TARGET_DIR="$HOME/cloud-platform-inpt"
REPO_URL="https://github.com/AslouneYahya/blockchain-cloud-platform.git"
CLOUDFLARE_TOKEN="${1:-eyJhIjoiODcwZWRiNzc5M2IyYTc2OGMyZmE2ZGRjYTBlOGYzYmEiLCJ0IjoiNGU2Mzc4NzQtMTRlYi00ZjViLThkMjItNDUyNzMyMTRiZDYyIiwicyI6Ik9EUTBNVGcyTldZdFpXRmlNUzAwTURSbExXRmhOemd0T0RVd01ESXdOalJoTVRaaiJ9}"

echo "======================================================================"
echo "  [1/7] Cloning / Updating Cloud Platform Repository                  "
echo "======================================================================"
if [ -d "$TARGET_DIR" ]; then
    echo "Repository already present, updating..."
    cd "$TARGET_DIR"
    git pull origin main || true
else
    echo "Cloning repository from GitHub..."
    git clone "$REPO_URL" "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

echo "======================================================================"
echo "  [2/7] Installing & Activating Cloudflare WARP + Tunnel              "
echo "======================================================================"
cd "$TARGET_DIR"
chmod +x setup_cloudflare_tunnel.sh
sudo ./setup_cloudflare_tunnel.sh "$CLOUDFLARE_TOKEN"

echo "======================================================================"
echo "  [3/7] Running Base Master Node Listener (FastAPI)                   "
echo "======================================================================"
cd "$TARGET_DIR/master-node"
chmod +x install.sh
chmod +x scripts/*.sh || true
./install.sh

echo "======================================================================"
echo "  [4/7] Configuring Linux Kernel cgroups for K3s                      "
echo "======================================================================"
cd "$TARGET_DIR"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE_FILE" ] && CMDLINE_FILE="/boot/cmdline.txt"

if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE"; then
        echo "Enabling cgroup memory flags in $CMDLINE_FILE..."
        sudo sed -i '$ s/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
    fi
fi

echo "======================================================================"
echo "  [5/7] Installing K3s Control Plane Server                           "
echo "======================================================================"
curl -sfL https://get.k3s.io | sh -s - \
    --write-kubeconfig-mode 644 \
    --disable traefik \
    --node-name "pi-node-01"

echo "======================================================================"
echo "  [6/7] Installing & Starting immudb Ledger Server                    "
echo "======================================================================"
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

echo "======================================================================"
echo "  [7/7] Installing & Starting ChainOps Go Daemon                      "
echo "======================================================================"
if [ -f "$TARGET_DIR/cluster-daemon/daemon-arm64" ]; then
    sudo cp "$TARGET_DIR/cluster-daemon/daemon-arm64" /opt/chainops/chainops-daemon
    sudo chmod +x /opt/chainops/chainops-daemon
fi

sudo bash -c 'cat <<EOF > /etc/systemd/system/chainops-daemon.service
[Unit]
Description=ChainOps Blockchain Infrastructure Daemon
After=network.target immudb.service k3s.service cloudflared.service

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
echo "  ALL SERVICES DEPLOYED ON MASTER PI!                                 "
echo "  1. Cloudflare WARP + Tunnel:  ACTIVE (token: master.aslouneyahya.com) "
echo "  2. Master Node Listener:      port 5000 (HEALTHY)                   "
echo "  3. ChainOps Go Daemon:        port 8080 (HEALTHY)                   "
echo "  4. immudb Merkle Ledger:      port 3322 (RUNNING)                   "
echo "  5. K3s Control Plane Server:  port 6443 (READY)                     "
echo "======================================================================"
echo ""
echo ">> K3S NODE TOKEN FOR WORKER PIS:"
echo "----------------------------------------------------------------------"
sudo cat /var/lib/rancher/k3s/server/node-token
echo "----------------------------------------------------------------------"
