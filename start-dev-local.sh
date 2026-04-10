#!/bin/bash

# Script de arranque de DESARROLLO (Localhost) — Agility Dashboard
# Inicia el backend (Uvicorn) y el frontend (Vite) en paralelo

echo "🛠️  Iniciando entorno de desarrollo local..."

# 0. Limpieza preventiva (matar procesos en puertos clave si quedaron colgados)
echo "🧹 Limpiando puertos 8000 y 5173..."
fuser -k 8000/tcp 5173/tcp 2>/dev/null

# 1. Backend (FastAPI)
echo "🐍 Levantando el Backend..."
cd backend
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "⚠️  Venv no encontrado, intentando con python3 global..."
fi
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACK_PID=$!
cd ..

# 2. Frontend (Vite)
echo "⚡ Levantando el Frontend..."
cd frontend
# Intentamos cargar NVM solo si el usuario lo usa
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
    nvm use 20 2>/dev/null || echo "Aviso: Node 20 no disponible en nvm, usando versión actual ($(node -v))."
fi
npm run dev -- --host --port 5173 &
FRONT_PID=$!
cd ..

# 3. Manejar el cierre (CTRL+C)
trap "echo '🛑 Deteniendo servicios...'; kill $BACK_PID $FRONT_PID; exit" SIGINT SIGTERM

echo ""
echo "✨ TODO LISTO ✨"
echo "🔗 URL de Desarrollo: http://localhost:5173"
echo "📂 Documentación API: http://localhost:8000/docs"
echo "------------------------------------------------"
echo "Presioná CTRL+C para detener ambos servicios."

# Esperar a los procesos
wait
