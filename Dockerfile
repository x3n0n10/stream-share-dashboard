# --- Stage 1: build the React frontend ---
FROM node:20-alpine AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# --- Stage 2: install backend production dependencies ---
FROM node:20-alpine AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# --- Stage 3: runtime image ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/src ./src
COPY --from=web-build /app/web/dist ./public

RUN addgroup -S dashboard && adduser -S dashboard -G dashboard
USER dashboard

EXPOSE 3000
CMD ["node", "src/index.js"]
