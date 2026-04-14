#!/bin/bash

# 🍏 Agility Dashboard - Deploy V5 (Resiliente)

# --- CONFIGURACIÓN REMOTA ---
RPI_HOST="bossvald@raspberrypi.local" 
RPI_PATH="/home/bossvald/Graficos-GP"
# ----------------------------

REAL_USER=${SUDO_USER:-$(whoami)}

echo "🚀 Iniciando flujo de despliegue..."

# 1. Sincronizar GitHub
echo "📥 Sincronizando con GitHub..."
git add .
git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null
if ! sudo -u $REAL_USER git push origin main; then
    echo "⚠️  Aviso: El push falló. Continuando para intentar el deploy remoto..."
fi

# 2. Desplegar producción Local (NO FATAL)
echo "🏗️ Intentando despliegue en Producción Local (Laptop)..."
if ! sudo docker compose -f docker-compose.prod.yml up --build -d --remove-orphans; then
    echo "⚠️  Aviso: Docker local falló (es probable que tu versión de Docker sea antigua)."
    echo "⏭️  Saltando despliegue local y siguiendo con la Raspberry..."
fi

# 3. DISPARAR ACTUALIZACIÓN REMOTA
echo "📡 Conectando a la Raspberry Pi ($RPI_HOST)..."

# 3a. Sincronizar secretos
echo "🔑 Sincronizando credenciales..."
sudo -u $REAL_USER scp backend/.env "$RPI_HOST:$RPI_PATH/backend/.env" 2>/dev/null
if [ -f "backend/token.json" ]; then
    sudo -u $REAL_USER scp backend/token.json "$RPI_HOST:$RPI_PATH/backend/token.json" 2>/dev/null
fi

# 3b. Rebuild remoto
echo "🏗️  Actualizando Raspberry (Esto es lo que importa)..."
sudo -u $REAL_USER ssh -t $RPI_HOST "cd $RPI_PATH && git fetch origin && git reset --hard origin/main && chmod +x rpi-update.sh && ./rpi-update.sh"

echo "✅ Proceso finalizado. Revisá graficosagiles.site"
