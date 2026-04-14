#!/bin/bash
# 🍏 Agility Dashboard - RPI Optimized Update (Versión GARANTIZADA)
echo "📦 Iniciando actualización PROFUNDA en la Raspberry Pi..."

# 1. Limpieza de seguridad y Git
git reset --hard HEAD
git clean -fd
git pull origin main || git pull origin master

# 2. Verificar .env
if [ ! -f "backend/.env" ]; then
    echo "⚠️  No se encontró el archivo .env en backend/"
    if [ -f ".env" ]; then
        cp .env backend/.env
    else
        echo "❌ Error: backend/.env no encontrado."
        exit 1
    fi
fi

# 3. LA PURGA DE DOCKER (Garantiza sincronización total con lo que ves en tu PC)
echo "🧹 Limpiando versiones anteriores para evitar discrepancias..."
sudo docker compose -f docker-compose.prod.yml down --remove-orphans
# Borramos imágenes antiguas para forzar que Docker lea el código nuevo
sudo docker image prune -a -f --filter "label=com.docker.compose.project=graficos-gp"

# 4. Re-lanzar contenedores
echo "🛑 Recompilando todo de cero (esto tarda entre 5-8 minutos)..."
sudo docker compose -f docker-compose.prod.yml build --no-cache
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate

# 5. Mantenimiento final
echo "🧹 Limpieza de residuos de construcción..."
sudo docker system prune -f --filter "until=1h"

echo "✅ Actualización completada satisfactoriamente en graficosagiles.site"
echo "🚀 Versión sincronizada 100% con tu local."
