# Deploying MedBridge AI

Two ways to run it. Both serve the website and the API from one address, so
there is nothing to configure for CORS and the recording WebSocket just works.

## A. One machine, one URL (the project's main design)

Use the GPU laptop. The app runs on clinic hardware and audio never leaves it.

1. **Build the website once** (and again after any frontend change):
   ```
   cd frontend
   npm ci
   npm run build
   ```
2. **Set the backend settings** in `backend/.env`:
   ```
   ENVIRONMENT=production
   JWT_SECRET=<random string, 32+ characters>
   MONGODB_URL=mongodb+srv://...
   USE_MOCK=false
   ANTHROPIC_API_KEY=...
   WHISPER_MODEL=medium          # "small" if the GPU has < 4 GB
   FRONTEND_URL=https://<your-public-url>   # used in password-reset emails
   GOOGLE_CLIENT_ID=...          # optional; add the public URL to the
                                 # "Authorized JavaScript origins" in Google Cloud
   ```
   With `ENVIRONMENT=production` the server refuses to start if the secret is
   the default one, too short, or mock mode is still on.
3. **Start it**:
   ```
   cd backend
   python run.py      # or: uvicorn main:app --host 0.0.0.0 --port 8000
   ```
   Open http://localhost:8000 — you should see the landing page, not JSON.
4. **Make it public (optional)** with a tunnel, for example
   `cloudflared tunnel --url http://localhost:8000`. HTTPS and the WebSocket
   both pass through; the app switches to `wss://` automatically.

## B. Docker (CPU only, for a demo server)

```
docker build -t medbridge-ai .
docker run --env-file backend/.env -e USE_MOCK=false -p 8000:8000 medbridge-ai
```
Use `WHISPER_MODEL=tiny` or `small` — there is no GPU in the container.

## Settings added for deployment

| Setting | Default | What it does |
|---|---|---|
| `ENVIRONMENT` | `development` | `production` turns on the startup safety checks |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated sites allowed to call the API. Only needed if the frontend is hosted on a different address than the backend |
| `FRONTEND_DIST` | `../frontend/dist` | Where the built website is; if it exists, FastAPI serves it |

## Before going live, remember

- Rate-limit counters live in memory and reset when the server restarts.
- Sign-in tokens last 8 hours. After that the app shows "session expired".
- Back up MongoDB Atlas data before deleting accounts: deleting a doctor
  removes their patients and records for good.
- Run the tests: `cd backend && python -m pytest` (CI does this on every push).
