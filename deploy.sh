#!/bin/bash

# 🍏 Agility Dashboard - Deploy V4 (Sin errores de Docker V1)

# --- CONFIGURACIÓN REMOTA ---
RPI_HOST="bossvald@raspberrypi.local" 
RPI_PATH="/home/bossvald/Graficos-GP"
# ----------------------------

REAL_USER=${SUDO_USER:-$(whoami)}

echo "🚀 Iniciando flujo de despliegue..."

# 1. Sincronizar GitHub
echo "📥 Sincronizando con GitHub como $REAL_USER..."
git add .
git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null
sudo -u $REAL_USER git push origin main

# 2. Desplegar producción Local
echo "🏗️ Desplegando en Producción Local..."
# FORZAMOS Docker Compose V2 (sin guion) para evitar el error de ContainerConfig
if ! sudo docker compose -f docker-compose.prod.yml up --build -d --remove-orphans; then
    echo "❌ Error en Docker Local. Asegúrate de tener instalado 'docker-compose-plugin'."
    exit 1
fi

# 3. DISPARAR ACTUALIZACIÓN REMOTA
echo "📡 Conectando a la Raspberry Pi ($RPI_HOST)..."

# 3a. Sincronizar secretos
echo "🔑 Sincronizando credenciales..."
sudo -u $REAL_USER scp backend/.env "$RPI_HOST:$RPI_PATH/backend/.env"
if [ -f "backend/token.json" ]; then
    sudo -u $REAL_USER scp backend/token.json "$RPI_HOST:$RPI_PATH/backend/token.json"
fi

# 3b. Rebuild remoto
echo "🏗️  Actualizando Raspberry..."
sudo -u $REAL_USER ssh -t $RPI_HOST "cd $RPI_PATH && git fetch origin && git reset --hard origin/main && chmod +x rpi-update.sh && ./rpi-update.sh"

echo "✅ Proceso finalizado."
