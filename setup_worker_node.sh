#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Zero-Config Worker Node Setup for Raspberry Pis
# Connects outbound to Master via: https://k3s.aslouneyahya.com
# NO cloudflared ingress (cloudflared is only for Master Control Plane)
# ==============================================================================
set -e

CLUSTER_TOKEN="K10b1a611dcae299e54ae3b462c66a9bfc4fcc01e768abcf2b22ba2a4e19bac01bd::server:inpt-blockchain-cluster-secret-2026"
MASTER_ENDPOINT="https://k3s.aslouneyahya.com"

echo "======================================================================"
echo "  [1/3] Removing any cloudflared ingress conflict on Worker           "
echo "======================================================================"
sudo systemctl stop cloudflared 2>/dev/null || true
sudo systemctl disable cloudflared 2>/dev/null || true
sudo rm -f /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload

echo "======================================================================"
echo "  [2/3] Configuring Linux Kernel cgroups on Worker Pi                 "
echo "======================================================================"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE_FILE" ] && CMDLINE_FILE="/boot/cmdline.txt"

if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE"; then
        echo "Adding cgroup memory flags in $CMDLINE_FILE..."
        sudo sed -i '$ s/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
    fi
fi

echo "======================================================================"
echo "  [3/3] Joining K3s Cluster via $MASTER_ENDPOINT                      "
echo "======================================================================"
NODE_HOSTNAME=$(hostname)

# Stop and wipe stale agent cache to force a fresh TLS handshake with new token
echo "Cleaning stale K3s agent cache and tokens..."
sudo systemctl stop k3s-agent.service 2>/dev/null || true
sudo rm -rf /var/lib/rancher/k3s/agent
sudo rm -f /etc/systemd/system/k3s-agent.service.env

curl -sfL https://get.k3s.io | K3S_URL="${MASTER_ENDPOINT}" K3S_TOKEN="${CLUSTER_TOKEN}" sh -s - \
    --node-name "${NODE_HOSTNAME}"

sudo systemctl daemon-reload
sudo systemctl enable --now k3s-agent.service || true
sudo systemctl restart k3s-agent.service || true

echo ""
echo "======================================================================"
echo "  WORKER PI CONNECTED AND RUNNING!                                    "
echo "  - cloudflared: DISABLED (Worker does not host public ingress)       "
echo "  - K3s Node:    JOINED TO https://k3s.aslouneyahya.com               "
echo "======================================================================"
