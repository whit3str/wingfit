FROM python:3.11-slim

WORKDIR /app

# Copier et installer les dépendances Python
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copier l'application
COPY app/ ./app/

# Créer les répertoires nécessaires
RUN mkdir -p /app/frontend
RUN mkdir -p /app/storage/assets
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
