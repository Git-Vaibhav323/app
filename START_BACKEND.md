# Start Backend Server

## For Skip On (REST API)

The Skip On feature uses REST API endpoints in `server.py` (FastAPI).

### Start the FastAPI server:

```bash
cd backend
uvicorn server:socket_app --host 0.0.0.0 --port 3001 --reload
```

**Important:** Use port **3001** (not 8001) to match the frontend configuration.

### Verify it's running:

Open: http://localhost:3001/api/

Should see: `{"message": "Skip On API", "version": "1.0.0"}`

### Test Skip On endpoint:

```bash
curl -X POST http://localhost:3001/api/skip/match \
  -H "Content-Type: application/json" \
  -d '{"guestId": "test123"}'
```

Should return: `{"status": "searching"}` or `{"status": "matched", "roomId": "...", ...}`

---

## Note

- The FastAPI server (`server.py`) handles REST API endpoints
- Socket.IO servers (`socket-server.js`, `engage-server.js`) are for other features
- Skip On uses REST + Firebase, NOT Socket.IO

