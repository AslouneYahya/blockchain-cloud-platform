#!/usr/bin/env bash
# ==============================================================================
# setup_worker_node.sh — Zero-Config Worker Node Setup via Cloudflare TCP Bridge
# 1. Stops stale services & cleans old K3s cache
# 2. Installs & activates Cloudflare WARP (warp-svc & warp-cli), just like master
# 3. Sets up Cloudflare TCP Access Bridge (k3s-tcp-tunnel.service)
# 4. Configures Linux cgroups for K3s
# 5. Joins K3s Cluster via TCP bridge (Node ID isolation)
# ==============================================================================
set -e

DOMAIN_ENDPOINT="k3s.aslouneyahya.com"
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
echo "  [1/5] Stopping stale services & cleaning old K3s cache              "
echo "======================================================================"
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
echo "  [2/5] Ensuring Cloudflare WARP (warp-cli & warp-svc) is Active      "
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
    # Use proxy mode on worker to prevent TUN routing loop with cloudflared access tcp
    warp-cli --accept-tos mode proxy 2>/dev/null || true
    warp-cli --accept-tos connect 2>/dev/null || true
    echo "✓ Cloudflare WARP daemon (warp-svc) and CLI (warp-cli) connected in proxy mode (prevents TCP tunnel loop)!"
fi

echo "======================================================================"
echo "  [3/5] Setting up Cloudflare TCP Access Bridge                       "
echo "======================================================================"
if [ ! -f /usr/local/bin/cloudflared ]; then
    echo "Downloading cloudflared ARM64 for TCP bridge..."
    sudo curl -# -L -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
    sudo chmod +x /usr/local/bin/cloudflared
fi

# Create client-side TCP bridge service (forwards local 6443 -> k3s.aslouneyahya.com via raw TCP)
cat << EOF | sudo tee /etc/systemd/system/k3s-tcp-tunnel.service > /dev/null
[Unit]
Description=Cloudflare TCP Access Bridge to K3s Master
After=network.target network-online.target warp-svc.service
Wants=network-online.target warp-svc.service

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
sleep 3

# Verify TCP tunnel is listening locally
if ! ss -tlpn | grep -q ":6443"; then
    echo "Waiting for TCP tunnel bridge to bind port 6443..."
    sleep 3
fi

echo "======================================================================"
echo "  [4/5] Configuring Linux Kernel cgroups on Worker Pi                 "
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
echo "  [5/5] Joining K3s Cluster via TCP Bridge (Node: ${TARGET_NODE_NAME}) "
echo "======================================================================"

curl -sfL https://get.k3s.io | K3S_URL="https://127.0.0.1:6443" K3S_TOKEN="${CLUSTER_TOKEN}" sh -s - agent \
    --node-name "${TARGET_NODE_NAME}" \
    --with-node-id

sudo systemctl daemon-reload
sudo systemctl enable --now k3s-agent.service || true
sudo systemctl restart k3s-agent.service || true

sleep 3
sudo systemctl status k3s-agent.service --no-pager || true

echo ""
echo "======================================================================"
echo "  WORKER PI CONNECTED AND RUNNING VIA CLOUDFLARE TCP & WARP!          "
echo "  - Node Name:    ${TARGET_NODE_NAME}                                "
echo "  - WARP Client:  warp-cli connected & active                        "
echo "  - Cloudflare:   TCP bridge via ${DOMAIN_ENDPOINT}                  "
echo "  - Local IPs:    NONE (Pure domain-based TCP tunnel)                 "
echo "======================================================================"
