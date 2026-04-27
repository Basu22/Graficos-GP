# Etapa 1: Construcción
FROM node:20-slim as build

WORKDIR /app

# Dependencias
COPY package*.json ./
RUN npm install

# Código fuente
COPY . .

# Generar los archivos estáticos (dist/)
# Usamos /api como base para que el Proxy lo capture
ENV VITE_API_URL=/api
RUN npm run build

# Etapa 2: Servidor de Producción (Nginx)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Exponemos el puerto 80 estándar
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
