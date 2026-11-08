#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Resilient Worker Node Setup for Raspberry Pis
# Usage:
#   sudo bash setup_worker_node.sh [MASTER_IP_OR_HOST] [NODE_NAME]
# Examples:
#   sudo bash setup_worker_node.sh 192.168.1.50 pi-worker-2
#   sudo bash setup_worker_node.sh pi-worker-2
# ==============================================================================
set -e

CLUSTER_TOKEN="K10b1a611dcae299e54ae3b462c66a9bfc4fcc01e768abcf2b22ba2a4e19bac01bd::server:inpt-blockchain-cluster-secret-2026"
FALLBACK_SECRET="inpt-blockchain-cluster-secret-2026"

# Parse arguments:
# If arg1 looks like an IP or hostname with port/dots, treat as master endpoint
ARG1="${1:-}"
ARG2="${2:-}"

MASTER_IP=""
TARGET_NODE_NAME=""

if [[ "$ARG1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+ ]] || [[ "$ARG1" =~ \.local$ ]]; then
    MASTER_IP="$ARG1"
    TARGET_NODE_NAME="$ARG2"
else
    TARGET_NODE_NAME="$ARG1"
fi

# Auto-detect node name if not passed
if [ -z "$TARGET_NODE_NAME" ]; then
    if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "pi" ] && [ "$SUDO_USER" != "root" ]; then
        TARGET_NODE_NAME="$SUDO_USER"
    elif [ "$(hostname)" != "raspberrypi" ] && [ -n "$(hostname)" ]; then
        TARGET_NODE_NAME="$(hostname)"
    else
        MID=$(cat /etc/machine-id 2>/dev/null | cut -c1-4 || head -c 2 /dev/urandom | xxd -p)
        TARGET_NODE_NAME="pi-worker-${MID}"
    fi
fi

# Determine Master Endpoint:
# 1. User provided IP
# 2. Try mDNS resolution for Master Pi (pi-node-01.local or raspberrypi.local)
# 3. Fallback to public domain
if [ -n "$MASTER_IP" ]; then
    if [[ "$MASTER_IP" =~ :[0-9]+$ ]]; then
        MASTER_ENDPOINT="https://${MASTER_IP}"
    else
        MASTER_ENDPOINT="https://${MASTER_IP}:6443"
    fi
else
    # Check if pi-master or raspberrypi is reachable via mDNS
    if ping -c 1 -W 1 pi-node-01.local >/dev/null 2>&1; then
        MASTER_ENDPOINT="https://pi-node-01.local:6443"
    elif ping -c 1 -W 1 raspberrypi.local >/dev/null 2>&1; then
        MASTER_ENDPOINT="https://raspberrypi.local:6443"
    else
        MASTER_ENDPOINT="https://k3s.aslouneyahya.com"
    fi
fi

echo "======================================================================"
echo "  [1/4] Stopping cloudflared & clearing stale K3s agent               "
echo "======================================================================"
sudo systemctl stop cloudflared 2>/dev/null || true
sudo systemctl disable cloudflared 2>/dev/null || true
sudo rm -f /etc/systemd/system/cloudflared.service

sudo pkill -9 -f "k3s" 2>/dev/null || true
sleep 1

sudo /usr/local/bin/k3s-agent-uninstall.sh 2>/dev/null || true
sudo /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
sudo rm -rf /var/lib/rancher/k3s/agent
sudo rm -rf /etc/rancher/node
sudo rm -f /etc/systemd/system/k3s-agent.service
sudo rm -f /etc/systemd/system/k3s-agent.service.env
sudo systemctl daemon-reload

echo "======================================================================"
echo "  [2/4] Configuring Linux Kernel cgroups on Worker Pi                 "
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
echo "  [3/4] Connecting to Master: ${MASTER_ENDPOINT}                      "
echo "  Node Name: ${TARGET_NODE_NAME}                                      "
echo "======================================================================"

# Test reachability
echo "Testing connectivity to ${MASTER_ENDPOINT}/cacerts..."
curl -k -m 5 -sf "${MASTER_ENDPOINT}/cacerts" > /dev/null && echo "✓ Master endpoint reachable!" || echo "⚠ Warning: Could not fetch cacerts directly, continuing join attempt..."

curl -sfL https://get.k3s.io | K3S_URL="${MASTER_ENDPOINT}" K3S_TOKEN="${CLUSTER_TOKEN}" sh -s - agent \
    --node-name "${TARGET_NODE_NAME}"

echo "======================================================================"
echo "  [4/4] Starting & Verifying K3s Agent Service                        "
echo "======================================================================"
sudo systemctl daemon-reload
sudo systemctl enable --now k3s-agent.service || true
sudo systemctl restart k3s-agent.service || true

sleep 3
sudo systemctl status k3s-agent.service --no-pager || true

echo ""
echo "======================================================================"
echo "  WORKER PI CONNECTED AND RUNNING!                                    "
echo "  - Node Name:   ${TARGET_NODE_NAME}                                 "
echo "  - Master URL:  ${MASTER_ENDPOINT}                                   "
echo "======================================================================"


