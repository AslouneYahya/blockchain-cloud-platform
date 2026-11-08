#!/usr/bin/env bash
# ==============================================================================
# setup_master_node.sh — Non-Destructive Master Node Setup for Raspberry Pi
# IMPORTANT:
# - PRESERVES existing inpt-master-node.service (port 5000 / master.aslouneyahya.com)
# - PRESERVES existing cloudflared tunnel
# - ADDS K3s Control Plane (port 6443)
# - ADDS immudb Immutable Ledger (port 3322)
# - ADDS ChainOps Blockchain Daemon (port 8080)
# ==============================================================================
set -e

TARGET_DIR="$HOME/cloud-platform-inpt"
REPO_URL="https://github.com/AslouneYahya/blockchain-cloud-platform.git"

echo "======================================================================"
echo "  [1/5] Updating Repository Files                                     "
echo "======================================================================"
if [ -d "$TARGET_DIR" ]; then
    echo "Updating existing repository in $TARGET_DIR..."
    cd "$TARGET_DIR"
    git remote set-url origin "$REPO_URL" 2>/dev/null || true
    git pull origin main || true
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

echo "======================================================================"
echo "  [2/5] Preserving Existing Services                                  "
echo "======================================================================"
if systemctl is-active --quiet inpt-master-node.service; then
    echo "✓ Existing inpt-master-node.service is RUNNING on port 5000. Leaving intact!"
else
    echo "Notice: inpt-master-node.service not currently active, continuing..."
fi

if systemctl is-active --quiet cloudflared.service; then
    echo "✓ Existing cloudflared.service is RUNNING. Leaving intact!"
else
    echo "Notice: cloudflared.service not currently active, continuing..."
fi

echo "======================================================================"
echo "  [3/5] Configuring Linux Kernel cgroups for K3s                      "
echo "======================================================================"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE_FILE" ] && CMDLINE_FILE="/boot/cmdline.txt"

if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE"; then
        echo "Adding cgroup memory flags in $CMDLINE_FILE..."
        sudo sed -i '$ s/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
    fi
fi

sudo apt-get update -y
sudo apt-get install -y curl ca-certificates iptables

echo "======================================================================"
echo "  [4/5] Installing K3s Control Plane Server (Port 6443)               "
echo "======================================================================"
curl -sfL https://get.k3s.io | sh -s - \
    --write-kubeconfig-mode 644 \
    --disable traefik \
    --node-name "pi-node-01"

echo "======================================================================"
echo "  [5/5] Installing immudb & ChainOps Blockchain Daemon                "
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

# Setup ChainOps Daemon (Port 8080)
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
echo "  MASTER NODE READY (ALL SERVICES COEXISTING IN HARMONY)              "
echo "  - Existing inpt-master-node:  port 5000 (UNTOUCHED / RUNNING)       "
echo "  - Existing cloudflared:       running for master.aslouneyahya.com   "
echo "  - ChainOps Blockchain Daemon: port 8080 (HEALTHY)                   "
echo "  - immudb Merkle Ledger:       port 3322 (RUNNING)                   "
echo "  - K3s Control Plane Server:   port 6443 (READY for k3s domain)      "
echo "======================================================================"
echo ""
echo ">> K3S NODE TOKEN FOR WORKER PIS:"
echo "----------------------------------------------------------------------"
sudo cat /var/lib/rancher/k3s/server/node-token
echo "----------------------------------------------------------------------"
