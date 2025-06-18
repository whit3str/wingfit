# Stage 1: Build Frontend (Angular)
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend (FastAPI)
FROM python:3.11-slim AS backend-builder

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copier la structure app/ (structure réelle de Wingfit)
COPY app/ ./app/

# Stage 3: Production
FROM python:3.11-slim AS production

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies and application
WORKDIR /app
COPY --from=backend-builder /app ./
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist/wingfit/browser /var/www/html

# Configure Nginx
COPY nginx.conf /etc/nginx/sites-available/default

# Configure Supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create data directory for SQLite database
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
