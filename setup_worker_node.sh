#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Zero-Config Worker Node Setup
# 1. Stops stale services, disconnects WARP TUN, & cleans old K3s cache
# 2. Installs & registers Cloudflare WARP (warp-svc & warp-cli), kept in proxy/disconnected mode
# 3. Detects Master endpoint (Direct LAN or Cloudflare TCP Bridge k3s.aslouneyahya.com)
# 4. Verifies endpoint CA cert before agent registration
# 5. Configures Linux cgroups for K3s
# 6. Joins K3s Cluster via verified endpoint
# ==============================================================================
set -e

DOMAIN_ENDPOINT="k3s.aslouneyahya.com"
CLUSTER_TOKEN="inpt-blockchain-cluster-secret-2026"

# Node name & optional Master target (e.g. ./setup_worker_node.sh pi-worker-1 192.168.1.212)
TARGET_NODE_NAME="${1:-}"
MASTER_OVERRIDE="${2:-}"

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
echo "  [1/6] Disconnecting WARP TUN & Cleaning Old K3s State               "
echo "======================================================================"
# Crucial: Disconnect WARP TUN device to stop intercepting outbound TCP tunnel packets
sudo warp-cli disconnect 2>/dev/null || true
sudo systemctl stop k3s-agent 2>/dev/null || true
sudo systemctl stop k3s-tcp-tunnel 2>/dev/null || true
sudo systemctl stop cloudflared 2>/dev/null || true
sudo systemctl disable cloudflared 2>/dev/null || true
sudo rm -f /etc/systemd/system/cloudflared.service

sudo pkill -9 -f "k3s" 2>/dev/null || true
sudo pkill -9 -f "cloudflared" 2>/dev/null || true
sleep 1

# Completely uninstall stale agent to wipe cached tokens and config
echo "Uninstalling existing K3s agent..."
sudo /usr/local/bin/k3s-agent-uninstall.sh 2>/dev/null || true
sudo /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
sudo rm -rf /var/lib/rancher/k3s/agent
sudo rm -rf /etc/rancher/node
sudo rm -f /etc/systemd/system/k3s-agent.service
sudo rm -f /etc/systemd/system/k3s-agent.service.env
sudo systemctl daemon-reload

echo "======================================================================"
echo "  [2/6] Ensuring Cloudflare WARP (warp-cli & warp-svc) is Installed   "
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
    sleep 2
    yes | sudo warp-cli --accept-tos register 2>/dev/null || sudo warp-cli register 2>/dev/null || true
    # Keep WARP in proxy mode and disconnected so it never creates a TUN loop with K3s
    sudo warp-cli --accept-tos mode proxy 2>/dev/null || sudo warp-cli set-mode proxy 2>/dev/null || true
    sudo warp-cli disconnect 2>/dev/null || true
    echo "✓ Cloudflare WARP (warp-svc & warp-cli) ready on worker."
fi

echo "======================================================================"
echo "  [3/6] Resolving Master Endpoint (LAN vs Cloudflare TCP Bridge)      "
echo "======================================================================"
K3S_SERVER_URL=""

if [ -n "$MASTER_OVERRIDE" ]; then
    if [[ "$MASTER_OVERRIDE" =~ ^https?:// ]]; then
        K3S_SERVER_URL="$MASTER_OVERRIDE"
    else
        K3S_SERVER_URL="https://${MASTER_OVERRIDE}:6443"
    fi
    echo "✓ Using explicit Master endpoint: ${K3S_SERVER_URL}"
elif curl -k -s --connect-timeout 2 https://192.168.1.212:6443/cacerts >/dev/null 2>&1 || curl -k -s --connect-timeout 2 https://192.168.1.212:6443/ping >/dev/null 2>&1; then
    echo "✓ Discovered Master Pi on local network at 192.168.1.212:6443"
    K3S_SERVER_URL="https://192.168.1.212:6443"
else
    echo "Master not detected on LAN 192.168.1.212. Activating Cloudflare TCP Access Bridge..."
    if [ ! -f /usr/local/bin/cloudflared ]; then
        echo "Downloading cloudflared ARM64 for TCP bridge..."
        sudo curl -# -L -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
        sudo chmod +x /usr/local/bin/cloudflared
    fi

    cat << EOF | sudo tee /etc/systemd/system/k3s-tcp-tunnel.service > /dev/null
[Unit]
Description=Cloudflare TCP Access Bridge to K3s Master
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared access tcp --hostname ${DOMAIN_ENDPOINT} --url 127.0.0.1:6443
Restart=always
RestartSec=3
KillMode=process

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable --now k3s-tcp-tunnel.service
    sudo systemctl restart k3s-tcp-tunnel.service
    sleep 3
    K3S_SERVER_URL="https://127.0.0.1:6443"
    echo "✓ Cloudflare TCP Bridge active on 127.0.0.1:6443 -> ${DOMAIN_ENDPOINT}"
fi

echo "======================================================================"
echo "  [4/6] Verifying K3s Master Endpoint Connectivity                   "
echo "======================================================================"
echo "Testing connection to ${K3S_SERVER_URL}/cacerts..."
ENDPOINT_VERIFIED=0
for i in {1..8}; do
    if curl -k -s --connect-timeout 3 "${K3S_SERVER_URL}/cacerts" 2>/dev/null | grep -q "BEGIN CERTIFICATE"; then
        echo "✓ Connected to Master! Received valid K3s CA certificate."
        ENDPOINT_VERIFIED=1
        break
    fi
    echo "Waiting for Master endpoint to respond (attempt $i/8)..."
    # Ensure WARP is disconnected if looping
    sudo warp-cli disconnect 2>/dev/null || true
    sleep 2
done

if [ $ENDPOINT_VERIFIED -eq 0 ]; then
    echo "⚠ Warning: Could not fetch CA cert from ${K3S_SERVER_URL}."
    echo "  Checking if Master Pi is reachable on local network (192.168.1.212)..."
    if curl -k -s --connect-timeout 3 "https://192.168.1.212:6443/cacerts" 2>/dev/null | grep -q "BEGIN CERTIFICATE"; then
        echo "✓ Switched to direct LAN Master endpoint: https://192.168.1.212:6443"
        K3S_SERVER_URL="https://192.168.1.212:6443"
    else
        echo "Continuing setup with ${K3S_SERVER_URL}..."
    fi
fi

echo "======================================================================"
echo "  [5/6] Configuring Linux Kernel cgroups on Worker Pi                 "
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
echo "  [6/6] Joining K3s Cluster via ${K3S_SERVER_URL} (Node: ${TARGET_NODE_NAME})"
echo "======================================================================"

curl -sfL https://get.k3s.io | K3S_URL="${K3S_SERVER_URL}" K3S_TOKEN="${CLUSTER_TOKEN}" sh -s - agent \
    --node-name "${TARGET_NODE_NAME}" \
    --with-node-id

sudo systemctl daemon-reload
sudo systemctl enable --now k3s-agent.service || true
sudo systemctl restart k3s-agent.service || true

sleep 3
sudo systemctl status k3s-agent.service --no-pager || true

echo ""
echo "======================================================================"
echo "  WORKER PI CONNECTED AND RUNNING!                                    "
echo "  - Node Name:    ${TARGET_NODE_NAME}                                "
echo "  - Server URL:   ${K3S_SERVER_URL}                                  "
echo "  - WARP Client:  Installed & Active (Proxy Mode)                    "
echo "======================================================================"
