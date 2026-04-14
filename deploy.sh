#!/bin/bash

# 🍏 Agility Dashboard - Deploy con gestión de usuarios corregida

# --- CONFIGURACIÓN REMOTA ---
RPI_HOST="bossvald@raspberrypi.local" 
RPI_PATH="/home/bossvald/Graficos-GP"
# ----------------------------

# Detectar el usuario real para las llaves SSH
REAL_USER=${SUDO_USER:-$(whoami)}

echo "🚀 Iniciando flujo de despliegue..."

# 1. Sincronizar GitHub (como usuario real para usar sus llaves SSH)
echo "📥 Sincronizando con GitHub como $REAL_USER..."
git add .
git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null
# Forzamos el uso del usuario real para el push
sudo -u $REAL_USER git push origin main
if [ $? -ne 0 ]; then
    echo "❌ Error: El push falló. Si te sigue pidiendo permiso denegado, probá correrlo sin 'sudo' delante."
fi

# 2. Desplegar producción en esta Laptop
echo "🏗️ Desplegando en Producción Local..."
if docker compose version &> /dev/null; then
    sudo docker compose -f docker-compose.prod.yml up --build -d --remove-orphans
else
    sudo docker-compose -f docker-compose.prod.yml up --build -d --remove-orphans
fi

# 3. DISPARAR ACTUALIZACIÓN REMOTA
echo "📡 Conectando a la Raspberry Pi ($RPI_HOST)..."

# 3a. Sincronizar secretos
echo "🔑 Sincronizando credenciales..."
sudo -u $REAL_USER scp backend/.env "$RPI_HOST:$RPI_PATH/backend/.env"
[ -f "backend/token.json" ] && sudo -u $REAL_USER scp backend/token.json "$RPI_HOST:$RPI_PATH/backend/token.json"

# 3b. Rebuild remoto
echo "🏗️  Actualizando Raspberry..."
sudo -u $REAL_USER ssh -t $RPI_HOST "cd $RPI_PATH && git fetch origin && git reset --hard origin/main && chmod +x rpi-update.sh && ./rpi-update.sh"

echo "✅ Proceso finalizado."
