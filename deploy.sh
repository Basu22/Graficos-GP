#!/bin/bash

# 🍏 Agility Dashboard - Full Deploy Workflow (Laptop -> GitHub -> Raspberry Pi)

# --- CONFIGURACIÓN REMOTA ---
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
# IMPORTANTE: Si da error de permisos, corre: sudo chown -R $USER:$USER .
echo "📥 Sincronizando con GitHub..."
git add .
git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main

# 3. Desplegar producción en esta Laptop
echo "🏗️ Desplegando en Producción Local..."
sudo docker compose -f docker-compose.prod.yml up --build -d --remove-orphans

# 4. DISPARAR ACTUALIZACIÓN REMOTA
echo "📡 Conectando a la Raspberry Pi ($RPI_HOST)..."

# 4a. Sincronizar secretos
echo "🔑 Sincronizando credenciales y tokens..."
scp backend/.env "$RPI_HOST:$RPI_PATH/backend/.env"
if [ -f "backend/token.json" ]; then
    scp backend/token.json "$RPI_HOST:$RPI_PATH/backend/token.json"
fi

# 4b. Rebuild remoto
echo "🏗️ Ejecutando script de actualización en la RPi..."
ssh -t $RPI_HOST "cd $RPI_PATH && git fetch origin && git reset --hard origin/main && chmod +x rpi-update.sh && ./rpi-update.sh"

echo "✅ Despliegue completado con éxito."
echo "✨ Dashboard: https://graficosagiles.site"
