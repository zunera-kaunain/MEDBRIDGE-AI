# MedBridge AI — optional container build (CPU only).
#
# The main deployment in the README is "one machine, one URL" on a GPU
# laptop. This Dockerfile is for running the same app in a container, e.g.
# for a demo on a CPU-only server. Use WHISPER_MODEL=tiny or small there.
#
#   docker build -t medbridge-ai .
#   docker run --env-file backend/.env -e ENVIRONMENT=production \
#       -e USE_MOCK=false -p 8000:8000 medbridge-ai

# ---- 1. Build the React app -------------------------------------------------
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Run FastAPI, which also serves the built React app ------------------
FROM python:3.12-slim
WORKDIR /app/backend

# WeasyPrint (PDF export) needs these system libraries.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
# The CUDA wheels are only useful with a GPU; skip them in the CPU image.
RUN grep -v "^nvidia-" requirements.txt > requirements.cpu.txt \
    && pip install --no-cache-dir -r requirements.cpu.txt

COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV ENVIRONMENT=production \
    FRONTEND_DIST=../frontend/dist
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
