#!/bin/bash

# Script de arranque de DESARROLLO (Localhost) — Agility Dashboard V2
# Inicia el backend (Uvicorn) y el frontend (Vite) en paralelo

echo "🛠️  Iniciando entorno de desarrollo local..."

# 0. Limpieza preventiva (Matar procesos viejos)
echo "🧹 Limpiando puertos 8000 (Backend) y 5173 (Frontend)..."
# Intentamos matar por puerto. Usamos sudo para asegurar que limpie todo.
sudo fuser -k 8000/tcp 5173/tcp 2>/dev/null || echo "Info: Puertos ya estaban libres."

# 1. Backend (FastAPI)
echo "🐍 Levantando el Backend..."
cd backend
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "⚠️  Venv no encontrado, intentando con python3 global..."
fi
# --reload permite que los cambios en Python se vean al instante
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /dev/null 2>&1 &
BACK_PID=$!
cd ..

# 2. Frontend (Vite)
echo "⚡ Levantando el Frontend..."
cd frontend
# Intentamos cargar NVM para asegurar Node 20
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    nvm use 20 > /dev/null 2>&1 || echo "Aviso: Usando versión actual de Node ($(node -v))."
fi

# Validar versión de Node para Vite 7
NODE_VER=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VER" -lt 20 ]; then
    echo "❌ ERROR: Necesitás al menos Node 20 para Vite 7. Tenés $NODE_VER."
    echo "Ejecutá: nvm install 20 && nvm use 20"
    kill $BACK_PID
    exit 1
fi

npm run dev -- --host --port 5173 &
FRONT_PID=$!
cd ..

# 3. Manejar el cierre (CTRL+C)
trap "echo '🛑 Deteniendo servicios...'; kill $BACK_PID $FRONT_PID 2>/dev/null; exit" SIGINT SIGTERM

echo ""
echo "✨ TODO LISTO ✨"
echo "🔗 URL de Desarrollo: http://localhost:5173"
echo "📂 Documentación API: http://localhost:8000/docs"
echo "------------------------------------------------"
echo "Si ves una pantalla blanca o error de 'crypto', asegurate de usar Node 20."
echo "Presioná CTRL+C para detener ambos servicios."

# Esperar a los procesos
wait
