#!/bin/bash
# 🍏 Agility Dashboard - RPI Optimized Update
echo "📦 Iniciando actualización en la Raspberry Pi..."

# 1. Limpieza de seguridad para evitar errores de lock de git
git reset --hard HEAD
git clean -fd
git pull origin main || git pull origin master

# 2. Verificar .env (Busca en backend/ que es donde lo deja deploy.sh)
if [ ! -f "backend/.env" ]; then
    echo "⚠️  No se encontró el archivo .env en backend/"
    # Intentamos buscar en raíz como fallback
    if [ -f ".env" ]; then
        cp .env backend/.env
    else
        echo "❌ Error: backend/.env no encontrado. El sistema no arrancará correctamente."
        exit 1
    fi
fi

# 3. Re-lanzar contenedores (Forzamos rebuild para evitar falsos CACHED)
echo "🛑 Reiniciando servicios y recompilando (esto puede tardar unos minutos)..."
sudo docker compose -f docker-compose.prod.yml build --no-cache frontend
sudo docker compose -f docker-compose.prod.yml up -d --remove-orphans

# 4. Mantenimiento preventivo (Vital en RPi para ahorrar espacio en la SD)
echo "🧹 Mantenimiento de storage (Docker prune)..."
sudo docker image prune -f
sudo docker system prune -f --filter "until=24h"

echo "✅ Actualización completada satisfactoriamente en graficosagiles.site"
