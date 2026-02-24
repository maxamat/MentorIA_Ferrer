# Build
FROM node:20-alpine AS build
WORKDIR /app

# Build args (llegan en docker build --build-arg ...)
ARG VITE_API_BASE
ARG VITE_API_KEY
ARG VITE_BASEDATOS_BASE
ARG VITE_BASEDATOS_API_KEY

# Exporta como env para que Vite las vea en npm run build
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_API_KEY=$VITE_API_KEY
ENV VITE_BASEDATOS_BASE=$VITE_BASEDATOS_BASE
ENV VITE_BASEDATOS_API_KEY=$VITE_BASEDATOS_API_KEY

COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
# Copiar explícitamente el video a public antes del build
RUN mkdir -p public && ls -la public/ || true
RUN echo "=== Verificando thumbnail.png antes del build ===" && ls -la public/thumbnail.png || echo "thumbnail.png NO ENCONTRADO"
RUN npm run build
# Verificar contenido en dist
RUN ls -la dist/ && echo "=== Archivos en dist ===" && find dist/ -name "*.png" && echo "=== Verificando thumbnail en dist ===" && ls -la dist/thumbnail.png || echo "thumbnail.png NO COPIADO A DIST"

# Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Configurar nginx con tipos MIME correctos
RUN printf '%s\n' \
'server {' \
'  listen 8080;' \
'  server_name _;' \
'  root /usr/share/nginx/html;' \
'  index index.html;' \
'  ' \
'  # Tipos MIME' \
'  types {' \
'    text/html html htm;' \
'    text/css css;' \
'    application/javascript js mjs;' \
'    application/json json;' \
'    image/png png;' \
'    image/jpeg jpg jpeg;' \
'    image/gif gif;' \
'    image/svg+xml svg;' \
'    video/mp4 mp4;' \
'    video/webm webm;' \
'  }' \
'  default_type application/octet-stream;' \
'  ' \
'  # Cabeceras de seguridad y cache' \
'  add_header X-Content-Type-Options "nosniff" always;' \
'  ' \
'  # Assets estáticos con cache' \
'  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|mp4|webm)$ {' \
'    expires 1y;' \
'    add_header Cache-Control "public, immutable";' \
'    try_files $uri =404;' \
'  }' \
'  ' \
'  # SPA fallback' \
'  location / {' \
'    try_files $uri $uri/ /index.html;' \
'  }' \
'}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080