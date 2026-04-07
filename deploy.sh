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
    # Se conecta vía SSH, entra a la carpeta, pullea y ejecuta el script rpi-update.sh
    sudo -u $CURRENT_USER ssh $RPI_HOST "cd $RPI_PATH && git pull origin main && chmod +x rpi-update.sh && ./rpi-update.sh"
    echo "✅ Despliegue remoto en Raspberry Pi completado."
fi

echo "✨ Proceso finalizado. Dashboard corriendo localmente en http://localhost"
echo "📊 Logs locales: sudo docker compose -f docker-compose.prod.yml logs -f"
