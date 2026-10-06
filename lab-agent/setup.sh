#!/usr/bin/env bash
# setup.sh — prepara a VM (Ubuntu 22.04/24.04, x86 ou ARM) para o Lab Real do CCNA Study OS.
#
# Uso (dentro da VM, a partir da pasta do repositório):
#   sudo bash lab-agent/setup.sh <SEU_UID_DO_FIREBASE>
#
# Instala: Docker, Containerlab, Node.js 22, Caddy (HTTPS automático) e o agente.
# Pode rodar de novo quando atualizar o código — ele só reinstala/reinicia o agente.

set -euo pipefail

FIREBASE_UID="${1:-}"
DIR_ORIGEM="$(cd "$(dirname "$0")" && pwd)"
DIR_AGENTE="/opt/lab-agent"
ARQ_ENV="/etc/lab-agent.env"

msg() { echo -e "\n\033[1;36m==> $*\033[0m"; }
falha() { echo -e "\033[1;31mERRO: $*\033[0m" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "rode com sudo: sudo bash $0 <UID>"
if [ -z "$FIREBASE_UID" ] && [ ! -f "$ARQ_ENV" ]; then
  falha "informe seu UID do Firebase (aparece no painel Lab Real do app): sudo bash $0 <UID>"
fi

export DEBIAN_FRONTEND=noninteractive

msg "Pacotes base"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git iptables netfilter-persistent iptables-persistent \
  debian-keyring debian-archive-keyring apt-transport-https

msg "Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

msg "Containerlab"
if ! command -v containerlab >/dev/null; then
  bash -c "$(curl -sL https://get.containerlab.dev)"
fi
containerlab version | head -5

msg "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

msg "Caddy (HTTPS automático com Let's Encrypt)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

msg "Firewall interno da VM (as imagens Ubuntu da Oracle bloqueiam 80/443 por padrão)"
for porta in 80 443; do
  iptables -C INPUT -p tcp --dport "$porta" -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 1 -p tcp --dport "$porta" -m conntrack --ctstate NEW -j ACCEPT
done
netfilter-persistent save >/dev/null

msg "Usuário de serviço e pastas"
id labagent >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/lab-agent --shell /usr/sbin/nologin labagent
usermod -aG docker labagent
USUARIO_SERVICO="labagent"
if getent group clab_admins >/dev/null; then
  usermod -aG clab_admins labagent
else
  echo "Aviso: grupo clab_admins não existe nesta versão do containerlab — o agente vai rodar como root."
  USUARIO_SERVICO="root"
fi
mkdir -p /var/lib/lab-agent/labs
chown -R labagent:labagent /var/lib/lab-agent

msg "Imagens do lab (FRRouting e host Linux)"
docker pull quay.io/frrouting/frr:10.2.1
docker pull ghcr.io/hellt/network-multitool:latest

msg "Código do agente"
mkdir -p "$DIR_AGENTE"
cp -r "$DIR_ORIGEM/package.json" "$DIR_ORIGEM/package-lock.json" "$DIR_ORIGEM/src" "$DIR_AGENTE/"
(cd "$DIR_AGENTE" && npm install --omit=dev --no-audit --no-fund)
chown -R root:root "$DIR_AGENTE"

IP_PUBLICO="$(curl -fsS https://api.ipify.org)"
DOMINIO="${IP_PUBLICO//./-}.sslip.io"

if [ ! -f "$ARQ_ENV" ]; then
  cat > "$ARQ_ENV" <<EOF
# Configuração do agente do Lab Real — edite e rode: sudo systemctl restart lab-agent
ALLOWED_UIDS=$FIREBASE_UID
REQUIRE_MFA=true
ALLOWED_ORIGINS=https://g-olivera.github.io
FIREBASE_PROJECT_ID=ccna-study-os
MAX_LABS=3
MAX_NODES=16
PORT=8787
HOST=127.0.0.1
DOMAIN=$DOMINIO
EOF
elif [ -n "$FIREBASE_UID" ]; then
  sed -i "s/^ALLOWED_UIDS=.*/ALLOWED_UIDS=$FIREBASE_UID/" "$ARQ_ENV"
fi
chmod 600 "$ARQ_ENV"
DOMINIO="$(grep '^DOMAIN=' "$ARQ_ENV" | cut -d= -f2)"

msg "Serviço systemd"
cat > /etc/systemd/system/lab-agent.service <<EOF
[Unit]
Description=CCNA Study OS - Lab Real (agente)
After=network-online.target docker.service
Requires=docker.service

[Service]
User=$USUARIO_SERVICO
EnvironmentFile=$ARQ_ENV
WorkingDirectory=$DIR_AGENTE
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=false

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable lab-agent >/dev/null
systemctl restart lab-agent

msg "Caddy → https://$DOMINIO"
cat > /etc/caddy/Caddyfile <<EOF
$DOMINIO {
	encode gzip
	reverse_proxy 127.0.0.1:8787
}
EOF
systemctl restart caddy

sleep 3
echo
echo "------------------------------------------------------------------"
echo " Pronto! Endereço do agente:  https://$DOMINIO"
echo " Teste no navegador:          https://$DOMINIO/saude"
echo " Cole esse endereço em js/lab-config.js no app."
echo " Logs:  journalctl -u lab-agent -f     |    journalctl -u caddy -f"
echo "------------------------------------------------------------------"
