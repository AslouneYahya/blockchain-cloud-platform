#!/usr/bin/env bash
# ==============================================================================
# setup_worker.sh — Dedicated Setup for Worker Raspberry Pis
# Connects to Master via Cloudflare Tunnel (https://k3s.aslouneyahya.com) or Master URL
# ==============================================================================
set -euo pipefail

K3S_TOKEN="${1:-}"
MASTER_ENDPOINT="${2:-https://k3s.aslouneyahya.com}"

if [ -z "$K3S_TOKEN" ]; then
    echo "======================================================================"
    echo "Error: K3s Node Token is required!"
    echo "Usage: sudo ./setup_worker.sh <K3S_NODE_TOKEN> [OPTIONAL_MASTER_ENDPOINT]"
    echo ""
    echo "Example:"
    echo "  sudo ./setup_worker.sh K10fa6c78...::server:... https://k3s.aslouneyahya.com"
    echo "======================================================================"
    exit 1
fi

echo "======================================================================"
echo "  [1/2] Configuring Linux Kernel cgroups on Worker Pi                 "
echo "======================================================================"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE_FILE" ] && CMDLINE_FILE="/boot/cmdline.txt"

if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE"; then
        echo "Adding cgroups flags for K3s..."
        sudo sed -i '$ s/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
    fi
fi

sudo apt-get update -y
sudo apt-get install -y curl ca-certificates iptables

echo "======================================================================"
echo "  [2/2] Joining K3s Cluster via $MASTER_ENDPOINT                      "
echo "======================================================================"
NODE_HOSTNAME=$(hostname)
curl -sfL https://get.k3s.io | K3S_URL="${MASTER_ENDPOINT}" K3S_TOKEN="${K3S_TOKEN}" sh -s - \
    --node-name "${NODE_HOSTNAME}"

echo ""
echo "======================================================================"
echo "  WORKER NODE JOINED SUCCESSFULLY!                                    "
echo "  Check node status on Master Pi with: sudo kubectl get nodes         "
echo "======================================================================"
