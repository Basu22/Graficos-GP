#!/bin/bash

# 🍏 Agility Dashboard - Deploy Final FIX

# --- CONFIGURACIÓN REMOTA ---
RPI_HOST="bossvald@raspberrypi.local" 
RPI_PATH="/home/bossvald/Graficos-GP"
# ----------------------------

echo "🚀 Iniciando flujo de despliegue..."

# 1. Sincronizar GitHub
echo "📥 Sincronizando con GitHub..."
git add .
git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
# Intentamos el push. Si falla por SSH, avisamos.
if ! git push origin main; then
    echo "❌ Error: El push a GitHub falló. ¿Cargaste tu clave SSH en GitHub?"
    exit 1
fi

# 2. Desplegar producción en esta Laptop
echo "🏗️ Desplegando en Producción Local..."
# FORZAMOS 'docker compose' (V2) para evitar el error 'ContainerConfig'
# Si no existe, avisamos que debe actualizar Docker
if docker compose version &> /dev/null; then
    sudo docker compose -f docker-compose.prod.yml up --build -d --remove-orphans
else
    echo "⚠️  ERROR CRÍTICO: No se encontró 'docker compose' (V2)."
    echo "Tu versión de docker-compose (V1) es demasiado vieja y causa el error ContainerConfig."
    echo "Por favor, instala docker-compose-plugin o Docker Desktop."
    exit 1
fi

# 3. DISPARAR ACTUALIZACIÓN REMOTA
echo "📡 Conectando a la Raspberry Pi ($RPI_HOST)..."

# 3a. Sincronizar secretos
echo "🔑 Sincronizando credenciales..."
scp backend/.env "$RPI_HOST:$RPI_PATH/backend/.env"
[ -f "backend/token.json" ] && scp backend/token.json "$RPI_HOST:$RPI_PATH/backend/token.json"

# 3b. Rebuild remoto
echo "🏗️  Actualizando Raspberry..."
ssh -t $RPI_HOST "cd $RPI_PATH && git fetch origin && git reset --hard origin/main && chmod +x rpi-update.sh && ./rpi-update.sh"

echo "✅ Despliegue completado con éxito."
