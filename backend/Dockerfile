FROM python:3.12-slim-bookworm

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Instalar Chromium y sus dependencias en Debian Bookworm
RUN python -m playwright install chromium
RUN python -m playwright install-deps chromium

# Copiar el código de la aplicación
COPY . .

# Crear usuario no-root
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]