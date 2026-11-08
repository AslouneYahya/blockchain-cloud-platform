#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Worker Node Setup for Raspberry Pis
# 1. Installs Cloudflare WARP client so worker connects to Cloudflare network
# 2. Configures cgroups
# 3. Joins K3s cluster via Cloudflare Tunnel (https://k3s.aslouneyahya.com)
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

echo "======================================================================"
echo "  [1/3] Installing & Connecting Cloudflare WARP                       "
echo "======================================================================"
RELEASE=$(lsb_release -cs 2>/dev/null || grep VERSION_CODENAME /etc/os-release | cut -d= -f2 || echo "bullseye")
if [ "$RELEASE" = "bullseye" ]; then
    DEB_URL="https://pkg.cloudflareclient.com/pool/bullseye/main/c/cloudflare-warp/cloudflare-warp_2026.3.846.0_arm64.deb"
else
    DEB_URL="https://pkg.cloudflareclient.com/pool/bookworm/main/c/cloudflare-warp/cloudflare-warp_2026.8.2115.0_arm64.deb"
fi

if [ ! -f /tmp/cloudflare-warp.deb ]; then
    echo "Downloading Cloudflare WARP..."
    curl -# -L -o /tmp/cloudflare-warp.deb "$DEB_URL" || true
fi

if [ -f /tmp/cloudflare-warp.deb ]; then
    rm -rf /tmp/warp_extract && mkdir -p /tmp/warp_extract
    dpkg-deb -x /tmp/cloudflare-warp.deb /tmp/warp_extract
    sudo cp /tmp/warp_extract/bin/warp-svc /bin/warp-svc || true
    sudo cp /tmp/warp_extract/bin/warp-cli /bin/warp-cli || true
    sudo chmod +x /bin/warp-svc /bin/warp-cli || true
    sudo cp /tmp/warp_extract/lib/systemd/system/warp-svc.service /etc/systemd/system/warp-svc.service || true
    sudo systemctl daemon-reload
    sudo systemctl enable --now warp-svc || true
    sleep 3
    yes | warp-cli --accept-tos register 2>/dev/null || true
    warp-cli --accept-tos mode warp 2>/dev/null || true
    warp-cli --accept-tos connect 2>/dev/null || true
fi

echo "======================================================================"
echo "  [2/3] Configuring Linux Kernel cgroups on Worker Pi                 "
echo "======================================================================"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE_FILE" ] && CMDLINE_FILE="/boot/cmdline.txt"

if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE"; then
        echo "Enabling cgroup memory flags in $CMDLINE_FILE..."
        sudo sed -i '$ s/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
    fi
fi

sudo apt-get update -y
sudo apt-get install -y curl ca-certificates iptables

echo "======================================================================"
echo "  [3/3] Joining K3s Cluster via Cloudflare ($MASTER_ENDPOINT)         "
echo "======================================================================"
NODE_HOSTNAME=$(hostname)
curl -sfL https://get.k3s.io | K3S_URL="${MASTER_ENDPOINT}" K3S_TOKEN="${K3S_TOKEN}" sh -s - \
    --node-name "${NODE_HOSTNAME}"

echo ""
echo "======================================================================"
echo "  WORKER PI JOINED TO CLUSTER VIA CLOUDFLARE!                         "
echo "  Verify on Master Pi with: sudo kubectl get nodes                    "
echo "======================================================================"
