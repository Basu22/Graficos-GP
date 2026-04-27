#!/bin/bash

# 🍏 Agility Dashboard - Deploy V5 (Resiliente)

# --- CONFIGURACIÓN REMOTA ---
RPI_HOST="bossvald@raspberrypi.local" 
RPI_PATH="/home/bossvald/Graficos-GP"
INFRA_PATH="/home/bossvald/infra-unificada"
# ----------------------------

REAL_USER=${SUDO_USER:-$(whoami)}

echo "🚀 Iniciando flujo de despliegue para Agility Dashboard..."

# 1. Sincronizar GitHub
echo "📥 Sincronizando con GitHub..."
git add .
git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null
if ! sudo -u $REAL_USER git push origin main; then
    echo "❌ ERROR FATAL: El push falló. El despliegue se detiene."
    exit 1
fi

# 2. DISPARAR ACTUALIZACIÓN REMOTA
echo "📡 Conectando a la Raspberry Pi ($RPI_HOST)..."

# 2a. Sincronizar secretos y tokens
echo "🔑 Sincronizando credenciales y tokens de Google..."
sudo -u $REAL_USER scp backend/.env "$RPI_HOST:$RPI_PATH/backend/.env" 2>/dev/null
if [ -f "backend/token.json" ]; then
    sudo -u $REAL_USER scp backend/token.json "$RPI_HOST:$RPI_PATH/backend/token.json" 2>/dev/null
fi

# 2b. Rebuild remoto vía Infra Unificada
echo "🏗️  Actualizando Raspberry (Vía Infra Unificada)..."
sudo -u $REAL_USER ssh -t $RPI_HOST "
    echo '--- Actualizando repositorio ---' && \
    cd $RPI_PATH && \
    git fetch origin && \
    git reset --hard origin/main && \
    echo '--- Reconstruyendo Agility Dashboard ---' && \
    cd $INFRA_PATH && \
    docker compose up -d --build dash-backend dash-frontend
"

echo "✅ Proceso finalizado. Revisá https://graficosagiles.site"
