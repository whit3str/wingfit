# Build Backend uniquement
FROM python:3.11-slim AS production

WORKDIR /app

# Copier et installer les dépendances Python
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copier l'application (structure app/)
COPY app/ ./app/

# Créer le répertoire pour la base de données
RUN mkdir -p /app/data

EXPOSE 8000

# Lancer FastAPI directement
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
