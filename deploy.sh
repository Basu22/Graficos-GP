#!/bin/bash

# Script de despliegue para Agility Dashboard (Modo Producción)
# Sube cambios a GitHub, construye y levanta la infraestructura

echo "🚀 Iniciando despliegue de Agility Dashboard..."

# 1. Verificar existencia del archivo .env en backend
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: No se encontró el archivo backend/.env"
    echo "Copia backend/.env.example a backend/.env y completa las credenciales de Jira/Gemini."
    exit 1
fi

# 2. Subir cambios a GitHub (para que la Raspberry pueda pulleralos)
echo "📥 Subiendo últimas correcciones a GitHub..."
git add .
git commit -m "Production Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main || git push origin master

# 3. Detener contenedores previos si existen
echo "🛑 Deteniendo contenedores actuales..."
sudo docker-compose -f docker-compose.prod.yml down --remove-orphans

# 4. Construir y levantar
echo "🏗️ Construyendo y levantando imágenes de producción con Docker..."
sudo docker-compose -f docker-compose.prod.yml up --build -d

# 5. Verificación de salud
echo "📡 Verificando salud de los servicios..."
sleep 5
sudo docker-compose -f docker-compose.prod.yml ps

echo "✅ Despliegue completado con éxito."
echo "🔗 El dashboard debería estar accesible en http://localhost"
echo "📝 Para ver logs: sudo docker-compose -f docker-compose.prod.yml logs -f"
