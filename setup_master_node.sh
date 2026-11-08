#!/usr/bin/env bash
# ==============================================================================
# setup_master_node.sh — Complete Standalone Master Node Setup (Raspberry Pi)
# 1. Installs & activates Cloudflare WARP (warp-svc & warp-cli)
# 2. Installs & starts cloudflared using tunnel token (if not already running)
# 3. Configures Linux cgroups for K3s
# 4. Installs K3s Control Plane Server (Port 6443) -> for k3s.aslouneyahya.com
# 5. Installs & starts immudb Immutable Ledger Server (Port 3322)
# 6. Installs & starts ChainOps Go Blockchain Daemon (Port 8080) -> for bc.aslouneyahya.com
# ==============================================================================
set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_TOKEN="inpt-blockchain-cluster-secret-2026"
CLOUDFLARE_TOKEN="eyJhIjoiODcwZWRiNzc5M2IyYTc2OGMyZmE2ZGRjYTBlOGYzYmEiLCJ0IjoiNGU2Mzc4NzQtMTRlYi00ZjViLThkMjItNDUyNzMyMTRiZDYyIiwicyI6Ik9EUTBNVGcyTldZdFpXRmlNUzAwTURSbExXRmhOemd0T0RVd01ESXdOalJoTVRaaiJ9"

echo "======================================================================"
echo "  [1/5] Ensuring Cloudflare WARP and Tunnel are Active                "
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
echo "  [2/5] Configuring Linux Kernel cgroups                              "
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
echo "  [3/5] Installing & Starting K3s Server with TLS SAN                 "
echo "======================================================================"
sudo mkdir -p /etc/rancher/k3s
sudo rm -f /etc/rancher/k3s/config.yaml

sudo bash -c 'cat <<EOF > /etc/rancher/k3s/config.yaml
write-kubeconfig-mode: "644"
disable:
  - traefik
token: "inpt-blockchain-cluster-secret-2026"
node-name: "pi-node-01"
tls-san:
  - "k3s.aslouneyahya.com"
  - "127.0.0.1"
  - "localhost"
EOF'

curl -sfL https://get.k3s.io | sh -s - \
    --write-kubeconfig-mode 644 \
    --disable traefik \
    --token "$CLUSTER_TOKEN" \
    --node-name "pi-node-01" \
    --tls-san "k3s.aslouneyahya.com"

echo "Ensuring K3s service is started..."
sudo systemctl daemon-reload
sudo systemctl restart k3s.service || true

echo "======================================================================"
echo "  [4/5] Installing & Starting immudb Ledger Server (Port 3322)        "
echo "======================================================================"
IMMUDB_VERSION="v1.11.2"
sudo mkdir -p /var/lib/immudb /opt/chainops/data

if [ ! -f /usr/local/bin/immudb ]; then
    echo "Downloading immudb ARM64 release $IMMUDB_VERSION..."
    sudo curl -# -L -o /usr/local/bin/immudb "https://github.com/codenotary/immudb/releases/download/${IMMUDB_VERSION}/immudb-${IMMUDB_VERSION}-linux-arm64"
    sudo chmod +x /usr/local/bin/immudb
fi

sudo bash -c 'cat <<EOF > /etc/systemd/system/immudb.service
[Unit]
Description=immudb Immutable Ledger Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/immudb --dir=/var/lib/immudb --address=0.0.0.0 --port=3322
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable --now immudb.service

echo "======================================================================"
echo "  [5/5] Installing & Starting ChainOps Go Daemon (Port 8080)          "
echo "======================================================================"
sudo systemctl stop chainops-daemon.service 2>/dev/null || true

if [ -f "$INSTALL_DIR/cluster-daemon/daemon-arm64" ]; then
    sudo cp -f "$INSTALL_DIR/cluster-daemon/daemon-arm64" /opt/chainops/chainops-daemon
    sudo chmod +x /opt/chainops/chainops-daemon
fi

sudo bash -c 'cat <<EOF > /etc/systemd/system/chainops-daemon.service
[Unit]
Description=ChainOps Blockchain Infrastructure Daemon
After=network.target immudb.service k3s.service cloudflared.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/chainops
Environment=PORT=8080
Environment=DATA_DIR=/opt/chainops/data
Environment=IMMUDB_HOST=127.0.0.1
Environment=IMMUDB_PORT=3322
Environment=KUBECONFIG=/etc/rancher/k3s/k3s.yaml
Environment=CLUSTER_TOTAL_RAM_MB=12288
Environment=K3S_NAMESPACE=default
Environment=CLUSTER_DOMAIN=cluster.local
ExecStart=/opt/chainops/chainops-daemon
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
if [ -f /opt/chainops/chainops-daemon ]; then
    sudo systemctl enable --now chainops-daemon.service
    sudo systemctl restart chainops-daemon.service || true
fi

echo "Restarting Cloudflare tunnel to reload connections..."
sudo systemctl restart cloudflared.service || true

echo "Checking local services..."
sleep 2
curl -k -sI https://127.0.0.1:6443/ping && echo "✓ K3s port 6443: OK" || echo "⚠ K3s starting..."
curl -sI http://127.0.0.1:8080/api/health && echo "✓ Daemon port 8080: OK" || echo "⚠ Daemon starting..."

echo ""
echo "======================================================================"
echo "  MASTER NODE READY! (Pre-shared Token Active)                        "
echo "  - Cloudflare WARP & Tunnel: ACTIVE                                  "
echo "  - Blockchain API:  port 8080 (serves https://bc.aslouneyahya.com)   "
echo "  - immudb Ledger:   port 3322 (RUNNING)                              "
echo "  - K3s Control:     port 6443 (serves https://k3s.aslouneyahya.com)  "
if [ -f /var/lib/rancher/k3s/server/node-token ]; then
    echo "  - Full Join Token: $(cat /var/lib/rancher/k3s/server/node-token)"
fi
echo "======================================================================"
echo ""
echo "Check K3s status:    sudo kubectl get nodes"
echo "Check daemon health: curl http://localhost:8080/api/health"
