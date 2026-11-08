#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Zero-Config Worker Node Setup for Raspberry Pis
# Strictly uses public domain: https://k3s.aslouneyahya.com (NO local IPs)
# Usage:
#   sudo bash setup_worker_node.sh [NODE_NAME]
# Examples:
#   sudo bash setup_worker_node.sh pi-worker-2
#   sudo bash setup_worker_node.sh pi-worker-1
# ==============================================================================
set -e

MASTER_ENDPOINT="https://k3s.aslouneyahya.com"
CLUSTER_TOKEN="K10b1a611dcae299e54ae3b462c66a9bfc4fcc01e768abcf2b22ba2a4e19bac01bd::server:inpt-blockchain-cluster-secret-2026"

# Determine unique node name (e.g. pi-worker-2, pi-worker-1)
TARGET_NODE_NAME="${1:-}"
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

echo "======================================================================"
echo "  [1/4] Stopping cloudflared & uninstalling stale K3s agent           "
echo "======================================================================"
sudo systemctl stop cloudflared 2>/dev/null || true
sudo systemctl disable cloudflared 2>/dev/null || true
sudo rm -f /etc/systemd/system/cloudflared.service

# Terminate any hung K3s processes that hold old tokens in memory
sudo pkill -9 -f "k3s" 2>/dev/null || true
sleep 1

# Completely uninstall stale agent to wipe cached tokens and config
echo "Uninstalling existing K3s agent and wiping cache..."
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
echo "  - Public Ingress: Controlled by Master Pi                           "
echo "======================================================================"
