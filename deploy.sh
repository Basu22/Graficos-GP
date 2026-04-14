#!/bin/bash

# 🍏 Agility Dashboard - Full Deploy Workflow (Laptop -> GitHub -> Raspberry Pi)

# --- CONFIGURACIÓN REMOTA ---
# Si sabés la IP, cambiala aquí para mayor velocidad.
RPI_HOST="bossvald@raspberrypi.local" 
RPI_PATH="/home/bossvald/Graficos-GP"
# ----------------------------

echo "🚀 Iniciando flujo de despliegue..."

# 1. Verificar .env local
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: backend/.env no encontrado."
    exit 1
fi

# 2. Sincronizar cambios a GitHub
echo "📥 Sincronizando con GitHub..."
# Si falla, recuerda: git remote set-url origin git@github.com:Basu22/Graficos-GP.git
git add .
git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main || echo "⚠️ Advertencia: El push falló. El código en la RPI podría ser antiguo."

# 3. Desplegar producción en esta Laptop
echo "🏗️ Desplegando en Producción Local..."
# Priorizamos 'docker compose' (v2) para evitar el error de 'ContainerConfig'
if docker compose version &> /dev/null; then
    echo "🐳 Usando Docker Compose V2"
    sudo docker compose -f docker-compose.prod.yml up --build -d --remove-orphans
else
    echo "🐳 Usando Docker Compose V1 (Legacy)"
    sudo docker-compose -f docker-compose.prod.yml up --build -d --remove-orphans
fi

# 4. DISPARAR ACTUALIZACIÓN REMOTA
echo "📡 Conectando a la Raspberry Pi ($RPI_HOST)..."

# 4a. Sincronizar secretos
echo "🔑 Sincronizando credenciales y tokens..."
scp backend/.env "$RPI_HOST:$RPI_PATH/backend/.env" 2>/dev/null
if [ -f "backend/token.json" ]; then
    scp backend/token.json "$RPI_HOST:$RPI_PATH/backend/token.json" 2>/dev/null
fi

# 4b. Rebuild remoto
echo "🏗️ Ejecutando script de actualización en la RPi..."
ssh -t $RPI_HOST "cd $RPI_PATH && git fetch origin && git reset --hard origin/main && chmod +x rpi-update.sh && ./rpi-update.sh"

echo "✅ Proceso finalizado."
