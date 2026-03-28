FROM node:20-slim

WORKDIR /app

# Copiamos archivos de dependencias
COPY package*.json ./

# Instalamos (esto puede tardar en la Pi, paciencia)
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto de Vite
EXPOSE 5173

# Comando para correr Vite en modo desarrollo pero accesible desde afuera
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
