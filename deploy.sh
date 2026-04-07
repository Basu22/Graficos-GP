#!/bin/bash

# 🍏 Agility Dashboard - Full Deploy Workflow (Laptop -> GitHub -> Raspberry Pi)
# Este script sincroniza cambios, despliega en producción local y dispara el despliegue remoto en la RPI.

# --- CONFIGURACIÓN REMOTA ---
# Usuario e IP de tu Raspberry
RPI_HOST="bossvald@raspberrypi.local" 
# Ruta absoluta en la Raspberry Pi
RPI_PATH="/home/bossvald/Graficos-GP/"
# ----------------------------

echo "🚀 Iniciando flujo completo de despliegue..."

# 1. Verificar .env local
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: backend/.env no encontrado."
    exit 1
fi

# 2. Sincronizar cambios a GitHub
echo "📥 Sincronizando con GitHub..."
CURRENT_USER=$(logname || echo $SUDO_USER)
sudo -u $CURRENT_USER git add .
sudo -u $CURRENT_USER git commit -m "Full Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
sudo -u $CURRENT_USER git push origin main

# 3. Desplegar producción en esta Laptop
echo "🏗️ Desplegando en Producción Local..."
sudo docker compose -f docker-compose.prod.yml down --remove-orphans
sudo docker compose -f docker-compose.prod.yml up --build -d

# 4. DISPARAR ACTUALIZACIÓN REMOTA (Raspberry Pi)
if [[ $RPI_HOST == *"XXX"* ]]; then
    echo "⚠️  Nota: No se disparó el despliegue automático en la Raspberry porque no tiene configurada la IP."
    echo "Editá deploy.sh y cambiá RPI_HOST por el tuyo para que sea automático de ahora en adelante."
else
    echo "📡 Conectando a la Raspberry Pi ($RPI_HOST)..."
    
    # 4a. Sincronizar secretos (.env y token.json)
    echo "🔑 Sincronizando credenciales y tokens..."
    sudo -u $CURRENT_USER scp backend/.env $RPI_HOST:$RPI_PATH/backend/.env
    sudo -u $CURRENT_USER scp backend/token.json $RPI_HOST:$RPI_PATH/backend/token.json 2>/dev/null || echo "⚠️  Nota: No se encontró token.json local para copiar."

    # 4b. Disparar actualización de código y rebuild
    sudo -u $CURRENT_USER ssh $RPI_HOST "cd $RPI_PATH && git fetch origin && git reset --hard origin/main && chmod +x rpi-update.sh && ./rpi-update.sh"
    echo "✅ Despliegue remoto en Raspberry Pi completado."
fi

echo "✨ Proceso finalizado. Dashboard corriendo localmente en http://localhost"
echo "📊 Logs locales: sudo docker compose -f docker-compose.prod.yml logs -f"
