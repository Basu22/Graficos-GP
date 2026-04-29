#!/bin/bash
echo "🔍 Chequeando sintaxis de archivos JSX..."
FILES=$(find src -name "*.jsx" -o -name "*.js")
ERROR_COUNT=0

for FILE in $FILES; do
  # Validación de sintaxis ultra rápida sin generar archivos
  ./node_modules/.bin/esbuild "$FILE" --bundle --dry-run --log-level=error > /tmp/esbuild_err 2>&1
  if [ $? -eq 0 ]; then
    echo "✅ $FILE"
  else
    echo "❌ $FILE (Error de sintaxis)"
    cat /tmp/esbuild_err
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi
done

if [ $ERROR_COUNT -eq 0 ]; then
  echo "✨ ¡Todos los archivos están limpios!"
  exit 0
else
  echo "🚨 Se encontraron $ERROR_COUNT archivos con errores."
  exit 1
fi
