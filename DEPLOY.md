# Deployment Guide

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│  Static Host    │  HTTPS  │  Render.com     │
│  (frontend)     │────────▶│  (backend)      │
│  your-domain.com│  WSS    │  FastAPI + WS   │
└─────────────────┘         └────────┬────────┘
                                     │ optional
                              ┌──────▼──────┐
                              │ MongoDB     │
                              │ Atlas       │
                              └─────────────┘
```

- **Frontend** — static files (`dist/`), hosted anywhere
- **Backend** — FastAPI service on Render, handles WebSocket signaling + chat
- **Database** — MongoDB Atlas (optional, only needed for chat persistence)

---

## 1. Deploy the backend to Render

### Create the service

1. Push this repo to GitHub (or connect your existing repo)
2. Go to [render.com/new/web-service](https://dashboard.render.com/new/web-service)
3. Connect your repo
4. Configure the service:

| Setting | Value |
|---|---|
| **Name** | `video-chat-room-api` (or whatever you like) |
| **Root Directory** | `backend` |
| **Runtime** | Python |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python server.py` |
| **Plan** | Free (works fine for small groups) |

### Environment variables

Set these in the Render dashboard under **Environment**:

| Variable | Value | Required |
|---|---|---|
| `CORS_ORIGINS` | `https://your-domain.com` | Yes — your frontend URL |
| `MONGO_URL` | `mongodb+srv://user:pass@cluster.mongodb.net/video-chat` | No — only for chat persistence |
| `DB_NAME` | `video_chat_room` | No — defaults to `team_call_db` |

> **Note:** If you skip `MONGO_URL`, chat still works in real-time — messages just won't persist across server restarts.

### Verify

After deploy, visit your Render service URL:

```
https://video-chat-room-api.onrender.com/api/health
```

You should see: `{"status":"ok","active_connections":0,"admin_id":null}`

---

## 2. Build the frontend

### Set the backend URL

Create a `.env.production` file in the project root:

```bash
VITE_BACKEND_URL=https://video-chat-room-api.onrender.com
```

Replace the URL with your actual Render service URL.

### Build

```bash
npm run build
```

This produces a `dist/` folder with static files.

### What's in `dist/`

```
dist/
├── index.html
├── favicon.svg
└── assets/
    ├── index-[hash].js
    └── index-[hash].css
```

---

## 3. Host the frontend on your static server

Upload the entire contents of `dist/` to your static hosting. The exact steps depend on your host:

### Generic static server (Namecheap, cPanel, etc.)

1. FTP/SFTP the contents of `dist/` to your web root (e.g., `public_html/` or a subdirectory)
2. Make sure `index.html` is served for all routes (SPA fallback)

### Nginx config (if you control the server)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    root /var/www/video-chat-room;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Netlify (alternative)

Just drag the `dist/` folder to [app.netlify.com/drop](https://app.netlify.com/drop). Done.

### Vercel (alternative)

```bash
npx vercel --prod
```

---

## 4. MongoDB Atlas (optional)

Only needed if you want chat messages to persist.

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user with read/write access
3. Whitelist `0.0.0.0/0` in Network Access (required for Render)
4. Get the connection string and set it as `MONGO_URL` in Render env vars

---

## Local development

```bash
# Terminal 1: frontend
npm run dev

# Terminal 2: backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python server.py
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8001`.

The frontend defaults to `http://localhost:8001` as the backend URL when `VITE_BACKEND_URL` is not set.

---

## Important notes

- **HTTPS required** — WebRTC and `getUserMedia` require a secure context. Your frontend must be served over HTTPS in production.
- **Render free tier** — The backend will spin down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds. Upgrade to a paid plan if you need always-on.
- **CORS** — Set `CORS_ORIGINS` to your exact frontend URL. Using `*` works but is less secure.
- **No TURN server** — The app uses STUN only. Users behind strict NATs/firewalls may fail to connect. For reliable connectivity, add a TURN server (e.g., Twilio or Metered).
- **Mesh limit** — WebRTC mesh works well for ~5-8 people. Beyond that, quality degrades. This is by design — it's a small group call app.
