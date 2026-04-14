#!/bin/bash

# 🍏 Agility Dashboard - Full Deploy Workflow (Laptop -> GitHub -> Raspberry Pi)

# --- CONFIGURACIÓN REMOTA ---
# Si raspberrypi.local falla, pon aquí la IP (ej: "192.168.1.100")
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
# Si te pide contraseña, recordá cambiar el remoto a SSH con:
# git remote set-url origin git@github.com:Basu22/Graficos-GP.git
git add .
git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main

# 3. Desplegar producción en esta Laptop
echo "🏗️ Desplegando en Producción Local..."
# Usamos docker-compose con guion para mayor compatibilidad en versiones antiguas
if command -v docker-compose &> /dev/null; then
    sudo docker-compose -f docker-compose.prod.yml up --build -d --remove-orphans
else
    sudo docker compose -f docker-compose.prod.yml up --build -d --remove-orphans
fi

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
