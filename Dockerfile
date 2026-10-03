# syntax=docker/dockerfile:1
#
# Build context MUST be the project root (Pet_Mobile_BE), not backend/:
#   docker build -t pet-helper-app:1.0.0 .
#
# Layout inside the image mirrors the host, because Express resolves the
# frontend relative to the backend:
#   app.js       : express.static(path.join(__dirname, "../frontend")) -> /app/frontend
#   config/upload: path.join(__dirname, "../../frontend/...")          -> /app/frontend
# so backend/ goes to /app/backend and frontend/ goes to /app/frontend.

FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# node_modules lives at /app so it is resolved from /app/backend
COPY --from=deps /app/node_modules ./node_modules

COPY backend/  ./backend/
COPY frontend/ ./frontend/

WORKDIR /app/backend
EXPOSE 3000

# Same image is reused by the `migrate` service with an overridden command
# (node database/migrate-all.js). Keep this as the app entrypoint.
CMD ["node", "bin/www"]
