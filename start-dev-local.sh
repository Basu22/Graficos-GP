#!/bin/bash

# Script de arranque de DESARROLLO (Localhost) — Agility Dashboard
# Inicia el backend (Uvicorn) y el frontend (Vite) en paralelo

echo "🛠️  Iniciando entorno de desarrollo local..."

# 1. Asegurar puerto 8000 (Backend)
echo "🐍 Levantando el Backend (FastAPI)..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACK_PID=$!
cd ..

# 2. Asegurar puerto 5173 (Frontend)
echo "⚡ Levantando el Frontend (Vite) con Node 20..."
cd frontend
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 2>/dev/null || echo "Aviso: NVM no configurado. Intentando con Node base..."
npm run dev -- --host --port 5173 &
FRONT_PID=$!
cd ..

# 3. Manejar el cierre (CTRL+C) para matar ambos procesos
trap "echo '🛑 Deteniendo servicios...'; kill $BACK_PID $FRONT_PID; exit" SIGINT SIGTERM

echo "🚀 Todo listo. Presioná CTRL+C para detener ambos servicios."
echo "🔗 Frontend: http://localhost:5173"
echo "🔗 Backend Docs: http://localhost:8000/docs"

# Esperar a los procesos (esto mantiene el script vivo)
wait
