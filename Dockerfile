# ============================================
# Alliance CRM — Production Dockerfile
# Single container: Node.js backend serves
# both API and built React frontend
# ============================================

FROM node:20-alpine

RUN apk add --no-cache postgresql-client

WORKDIR /app

# Install and build frontend
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Clean up frontend dev dependencies (keep only dist)
RUN rm -rf frontend/node_modules frontend/src frontend/public frontend/*.config.* frontend/index.html

# Install backend dependencies
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/

# Copy root-level files
COPY .env.production ./.env
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV BACKEND_PORT=3000

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "backend/server.js"]
