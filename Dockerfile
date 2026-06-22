# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

# Sin módulos nativos ni Prisma: no se requieren build tools ni openssl
WORKDIR /app

# Manifiestos primero para maximizar la caché de capas
COPY package*.json ./

COPY prisma ./prisma/

# Instalación completa (dev + prod): habilita nest build y la CLI de NestJS
RUN npm ci

# Generar el cliente de Prisma para corregir los tipos de TS en las tablas V2
RUN npx prisma generate

# Copiar fuentes y compilar TypeScript → dist/
# nest-cli.json (assets: ["protos/**/*"]) copia src/protos/integration.proto → dist/protos/
COPY . .

RUN npm run build

# Podar devDependencies en el árbol actual:
# elimina @nestjs/cli, typescript, ts-node, etc.
# Las dependencias de producción (axios, grpc-js, etc.) sobreviven
RUN npm prune --production

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

RUN apk add --no-cache openssl

# Sin Prisma ni bcrypt: no se requiere openssl ni ningún paquete Alpine adicional
WORKDIR /app

# node_modules podadas: solo prod — axios, @grpc/grpc-js, @nestjs/* y sus transitivas
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Compilado final: dist/main.js + dist/protos/integration.proto
COPY --chown=node:node --from=builder /app/dist ./dist

ENV NODE_ENV=production

# Canal REST — API HTTP del microservicio Integración
EXPOSE 3003

# Canal gRPC — IntegrationService (package: booking.integration.v1)
# Consumido por microservicio-reservas-booking en la SAGA
EXPOSE 5003

USER node

CMD ["node", "dist/main"]
