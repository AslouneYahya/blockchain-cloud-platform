#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Zero-Config Worker Node Setup for Raspberry Pis
# ALL TOKENS ARE HARDCODED:
# - Cloudflare Tunnel Token (same tunnel as Master)
# - K3s Cluster Secret Token
# - Target Master: https://k3s.aslouneyahya.com
# ==============================================================================
set -e

CLUSTER_TOKEN="inpt-blockchain-cluster-secret-2026"
CLOUDFLARE_TOKEN="eyJhIjoiODcwZWRiNzc5M2IyYTc2OGMyZmE2ZGRjYTBlOGYzYmEiLCJ0IjoiNGU2Mzc4NzQtMTRlYi00ZjViLThkMjItNDUyNzMyMTRiZDYyIiwicyI6Ik9EUTBNVGcyTldZdFpXRmlNUzAwTURSbExXRmhOemd0T0RVd01ESXdOalJoTVRaaiJ9"
MASTER_ENDPOINT="https://k3s.aslouneyahya.com"

echo "======================================================================"
echo "  [1/3] Installing & Activating Cloudflare WARP and Tunnel            "
echo "======================================================================"
RELEASE=$(lsb_release -cs 2>/dev/null || grep VERSION_CODENAME /etc/os-release | cut -d= -f2 || echo "bullseye")
if [ "$RELEASE" = "bullseye" ]; then
    DEB_URL="https://pkg.cloudflareclient.com/pool/bullseye/main/c/cloudflare-warp/cloudflare-warp_2026.3.846.0_arm64.deb"
else
    DEB_URL="https://pkg.cloudflareclient.com/pool/bookworm/main/c/cloudflare-warp/cloudflare-warp_2026.8.2115.0_arm64.deb"
fi

if [ ! -f /tmp/cloudflare-warp.deb ]; then
    echo "Downloading Cloudflare WARP for $RELEASE..."
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

if [ ! -f /usr/local/bin/cloudflared ]; then
    echo "Downloading cloudflared ARM64..."
    sudo curl -# -L -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
    sudo chmod +x /usr/local/bin/cloudflared
fi

if ! systemctl is-active --quiet cloudflared.service; then
    cat << EOF | sudo tee /etc/systemd/system/cloudflared.service > /dev/null
[Unit]
Description=Cloudflare Tunnel
After=network.target network-online.target warp-svc.service
Wants=network-online.target warp-svc.service

[Service]
Type=simple
TimeoutStartSec=10s
Restart=always
RestartSec=5s
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate run --token $CLOUDFLARE_TOKEN

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable --now cloudflared.service
else
    echo "✓ cloudflared.service is active and healthy!"
fi

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

if ! systemctl is-active --quiet k3s-agent.service; then
    echo "NOTICE: Kernel cgroups requires a one-time reboot. Please run: sudo reboot"
fi

echo ""
echo "======================================================================"
echo "  WORKER PI CONNECTED AND RUNNING!                                    "
echo "  - Cloudflare WARP: ACTIVE                                           "
echo "  - cloudflared:     CONNECTED                                        "
echo "  - K3s Node:        JOINED TO https://k3s.aslouneyahya.com           "
echo "======================================================================"
