# Frontend Facylitech: build de Vite servido por Caddy, que además hace de proxy
# a la API (/api, /media) y entrega HTTPS automático. Mismo origen para web y
# API: sin CORS, y HTTPS es obligatorio para GPS y cámara en el celular.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Ruta relativa: el navegador llama a la API en el mismo dominio (Caddy la reenvía).
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
# Botones de cuentas demo en /login: solo para una demostración, nunca con datos reales.
ARG VITE_MOSTRAR_CUENTAS_DEMO=false
ENV VITE_MOSTRAR_CUENTAS_DEMO=$VITE_MOSTRAR_CUENTAS_DEMO
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
