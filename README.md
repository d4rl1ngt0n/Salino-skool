# Salino GmbH Platform

A community and education platform by Salino GmbH.

## Getting Started

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Run the backend server:
```bash
npm run dev
```

The backend API will be available at `http://localhost:3001`

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
VITE_API_URL=http://localhost:3001/api
```

3. Run the frontend development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

**Backend:**
```bash
cd server
npm run build
npm start
```

**Frontend:**
```bash
npm run build
```

## Push to GitHub

1. **Create a new repository** on [GitHub](https://github.com/new):
   - Name it (e.g. `salino-skool`), leave it empty (no README/license).
   - Copy the repo URL (e.g. `https://github.com/yourusername/salino-skool.git`).

2. **Add the remote and push** (from the project root):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repo name.

## Render CLI (deploy from terminal)

With the [Render CLI](https://render.com/docs/cli) installed, you can manage deploys from the terminal.

### Setup (one-time)

```bash
render login          # Opens browser to authenticate
render workspace set  # Choose your workspace if prompted
```

### Common commands

```bash
# List your services and get IDs
render services

# Trigger a deploy for a service (use service ID from list above)
render deploys create srv-xxxxx

# Deploy and wait until complete
render deploys create srv-xxxxx --wait

# Stream live logs
render services logs srv-xxxxx

# Validate the Blueprint (render.yaml)
render blueprints validate
```

### First-time: create services from Blueprint

1. Push `render.yaml` to your repo (it defines the backend API).
2. In [Render Dashboard](https://dashboard.render.com) → **New +** → **Blueprint**.
3. Connect your GitHub repo. Render will create the `salino-api` Web Service from the Blueprint.
4. After that, use the CLI to deploy: `render deploys create srv-<YOUR_API_SERVICE_ID>`.

---

## Deploy on Render (Dashboard)

After the code is on GitHub, deploy the **backend** on Render so the API is live. Then deploy the **frontend** (Netlify or Render Static Site) and point it at the API.

### 1. Backend (API) on Render

1. Go to [Render](https://render.com) and sign in (or create an account). Connect your GitHub if prompted.
2. **Dashboard → New + → Web Service**.
3. Connect the repository that contains this project (e.g. `salino-skool`).
4. Configure the service:
   - **Name:** e.g. `salino-api`
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. **Create Web Service**. Render will build and deploy. Note the URL (e.g. `https://salino-api.onrender.com`).
6. The backend uses SQLite and stores data in `server/data/`. On Render the filesystem is ephemeral, so data can reset on redeploy. For persistent data you’d later switch to a hosted DB (e.g. PostgreSQL on Render); for now the app will work and the default user will be re-created on each deploy.

### 2. Frontend (optional: Render Static Site or Netlify)

- **Render:** New + → **Static Site** → same repo, **Publish directory:** `dist`, **Build command:** `npm run build`. Add env var `VITE_API_URL` = `https://salino-api.onrender.com/api` (your backend URL + `/api`).
- **Netlify:** See “Deploying to Netlify” below; set `VITE_API_URL` to your Render backend URL + `/api`.

## Deploying to Netlify (for others to access)

The app has a **frontend** (this repo root) and a **backend** (`server/`). Netlify hosts static sites, so you deploy the frontend on Netlify and host the backend elsewhere.

### 1. Host the backend

Deploy the `server/` folder to a Node host, for example:

- **Render** (render.com): New → Web Service → connect repo, set root to `server`, build `npm install`, start `npm start`. Note the URL (e.g. `https://your-api.onrender.com`).
- **Railway** (railway.app): New project → deploy from GitHub, set root to `server`, same build/start. Note the URL.

Ensure the backend has **CORS** allowing your Netlify domain (the default `cors()` in `server` allows all origins).

### 2. Deploy the frontend to Netlify

1. Push your code to GitHub (or GitLab/Bitbucket).
2. In [Netlify](https://app.netlify.com): **Add new site → Import an existing project** and connect the repo.
3. Netlify will use the repo root and the existing `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Add an **environment variable** in Netlify:
   - **Key:** `VITE_API_URL`
   - **Value:** your backend URL + `/api` (e.g. `https://your-api.onrender.com/api`)
5. Trigger a **Deploy** (or push to the connected branch).

Your site will be at `https://<your-site>.netlify.app`. The frontend will call your backend for login, courses, and resources.

### 3. Optional: custom domain

In Netlify: **Domain settings** → add your domain and follow the DNS steps.

## Project Structure

```
src/
  ├── components/     # Reusable UI components
  ├── pages/         # Page components
  ├── App.tsx        # Main app component with routing
  ├── main.tsx       # Entry point
  └── index.css      # Global styles
```

## Features

- ✅ Navigation structure (Community, Classroom, Calendar, Members, Leaderboards, About)
- ✅ Responsive layout
- ✅ Search functionality (UI)
- 🔄 User authentication (Phase 2)
- 🔄 Classroom with courses (Phase 3)
- 🔄 Community feed (Phase 4)
- 🔄 Additional features (Phase 5)
