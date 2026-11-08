#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Worker Node Setup for Raspberry Pis
# Joins the cluster via Cloudflare Tunnel (https://k3s.aslouneyahya.com)
# ==============================================================================
set -e

K3S_TOKEN="${1:-}"
MASTER_ENDPOINT="${2:-https://k3s.aslouneyahya.com}"

if [ -z "$K3S_TOKEN" ]; then
    echo "======================================================================"
    echo "Error: K3s Node Token is required!"
    echo "Usage: sudo ./setup_worker_node.sh <K3S_NODE_TOKEN> [OPTIONAL_ENDPOINT]"
    echo ""
    echo "Example:"
    echo "  sudo ./setup_worker_node.sh K10fa6c...::server:... https://k3s.aslouneyahya.com"
    echo "======================================================================"
    exit 1
fi

echo "=== [1/2] Configuring Linux Kernel cgroups on Worker Pi ==="
CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE_FILE" ] && CMDLINE_FILE="/boot/cmdline.txt"

if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE"; then
        echo "Enabling cgroup memory flags..."
        sudo sed -i '$ s/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
    fi
fi

sudo apt-get update -y
sudo apt-get install -y curl ca-certificates iptables

echo "=== [2/2] Connecting Worker to K3s Cluster via $MASTER_ENDPOINT ==="
NODE_HOSTNAME=$(hostname)
curl -sfL https://get.k3s.io | K3S_URL="${MASTER_ENDPOINT}" K3S_TOKEN="${K3S_TOKEN}" sh -s - \
    --node-name "${NODE_HOSTNAME}"

echo ""
echo "======================================================================"
echo "  WORKER NODE JOINED SUCCESSFULLY!                                    "
echo "  Check cluster status on Master Pi with: sudo kubectl get nodes      "
echo "======================================================================"
