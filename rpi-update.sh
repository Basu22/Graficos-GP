#!/bin/bash

# Script de actualización para Raspberry Pi — Agility Dashboard
# Este script actualiza el código desde GitHub, mantiene el .env local 
# y relanza los contenedores de producción.

echo "📦 Iniciando actualización en la Raspberry Pi..."

# 1. Traer cambios de GitHub
echo "📥 Descargando cambios más recientes desde GitHub..."
git pull origin main || git pull origin master

# 2. Verificar que exista el archivo .env
if [ ! -f ".env" ]; then
    echo "⚠️  No se encontró el archivo .env en la raíz."
    echo "Asegurate de copiar el archivo .env del local a la Raspberry."
    exit 1
fi

# 3. Detener contenedores actuales
echo "🛑 Deteniendo servicios..."
sudo docker-compose -f docker-compose.prod.yml down

# 4. Construir y levantar con Docker Compose
echo "🏗️  Re-construyendo imágenes y levantando el sistema..."
sudo docker-compose -f docker-compose.prod.yml up --build -d

# 5. Limpieza (opcional) para ahorrar espacio en la SD de la Raspberry
echo "🧹 Limpiando imágenes huérfanas para ahorrar espacio..."
sudo docker image prune -f

echo "✅ Actualización completada satisfactoriamente."
echo "🔗 Tu dashboard debería estar corriendo en el puerto 80."
