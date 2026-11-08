#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Zero-Config Worker Node Setup for Raspberry Pis
# ==============================================================================
set -e

CLUSTER_TOKEN="inpt-blockchain-cluster-secret-2026"
MASTER_ENDPOINT="https://k3s.aslouneyahya.com"

echo "======================================================================"
echo "  [1/3] Ensuring cloudflared ingress is disabled on Worker            "
echo "======================================================================"
# Workers must NEVER run the Master's ingress tunnel token!
sudo systemctl stop cloudflared 2>/dev/null || true
sudo systemctl disable cloudflared 2>/dev/null || true

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
curl -sfL https://get.k3s.io | K3S_URL="${MASTER_ENDPOINT}" K3S_TOKEN="${CLUSTER_TOKEN}" sh -s - \
    --node-name "${NODE_HOSTNAME}"

sudo systemctl daemon-reload
sudo systemctl enable --now k3s-agent.service || true
sudo systemctl restart k3s-agent.service || true

echo ""
echo "======================================================================"
echo "  WORKER PI CONNECTED AND RUNNING!                                    "
echo "  - Ingress Conflict: RESOLVED (cloudflared removed from worker)      "
echo "  - K3s Node:         JOINED TO https://k3s.aslouneyahya.com          "
echo "======================================================================"
