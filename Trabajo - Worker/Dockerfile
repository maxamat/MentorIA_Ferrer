FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias para WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
  && rm -rf /var/lib/apt/lists/*

COPY app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app
COPY public /app/public

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host=0.0.0.0", "--port=8080"]
