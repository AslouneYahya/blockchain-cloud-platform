#!/usr/bin/env bash
# ==============================================================================
# setup_master.sh — Dedicated Setup for the Master Raspberry Pi
# (K3s Control Plane + immudb Immutable Ledger + ChainOps Go Daemon)
# ==============================================================================
set -euo pipefail

echo "======================================================================"
echo "  [1/4] Configuring Linux Kernel cgroups on Master Pi                 "
echo "======================================================================"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE_FILE" ] && CMDLINE_FILE="/boot/cmdline.txt"

if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE"; then
        echo "Adding cgroups flags for K3s..."
        sudo sed -i '$ s/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
        echo "Notice: cgroups enabled. (If K3s fails to start, a reboot 'sudo reboot' may be needed)."
    fi
fi

sudo apt-get update -y
sudo apt-get install -y curl ca-certificates iptables

echo "======================================================================"
echo "  [2/4] Installing K3s Control Plane Server                           "
echo "======================================================================"
curl -sfL https://get.k3s.io | sh -s - \
    --write-kubeconfig-mode 644 \
    --disable traefik \
    --node-name "pi-node-01"

echo "Waiting for K3s to initialize..."
sleep 5

echo "======================================================================"
echo "  [3/4] Installing & Starting immudb Ledger                           "
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
echo "  [4/4] Setting up ChainOps Go Daemon Service                         "
echo "======================================================================"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/cluster-daemon/daemon-arm64" ]; then
    sudo cp "$SCRIPT_DIR/cluster-daemon/daemon-arm64" /opt/chainops/chainops-daemon
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
echo "  MASTER NODE READY!                                                  "
echo "======================================================================"
echo ""
echo ">> YOUR K3S CLUSTER NODE TOKEN (Copy this for worker nodes):"
echo "----------------------------------------------------------------------"
sudo cat /var/lib/rancher/k3s/server/node-token
echo "----------------------------------------------------------------------"
echo ""
