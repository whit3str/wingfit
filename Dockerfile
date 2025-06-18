# Build Backend
FROM python:3.11-slim AS production

WORKDIR /app

# Copier et installer les dépendances Python
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copier l'application depuis le répertoire backend/
COPY backend/ ./

# Copier également le répertoire src/ si nécessaire
COPY src/ ./src/

# Créer le répertoire pour la base de données
RUN mkdir -p /app/data

EXPOSE 8000

# Lancer FastAPI (à adapter selon le point d'entrée réel)
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
