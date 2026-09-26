FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render dynamically injects $PORT at runtime (defaults to 10000)
ENV PORT=10000
EXPOSE 10000

# Using 'exec' and shell string expansion allows Uvicorn to read Render's dynamic $PORT variable
CMD exec uvicorn main:app --host 0.0.0.0 --port $PORT