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

# Copy backend dependencies and application
WORKDIR /app
COPY --from=backend-builder /app ./
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy frontend build to be served by FastAPI
COPY --from=frontend-builder /app/frontend/dist/wingfit/browser ./static

# Create data directory for SQLite database
RUN mkdir -p /app/data

EXPOSE 8000

# Run FastAPI directly (Nginx reverse proxy will handle external access)
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
