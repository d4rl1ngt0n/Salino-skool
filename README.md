# Salino GmbH Platform

A community and education platform by Salino GmbH.

## Getting Started

### Backend Setup

1. **Set up Supabase Database** (recommended for persistent data):
   - Go to [Supabase](https://supabase.com) and create a free account
   - Create a new project
   - Go to **Settings → Database** and copy the **Connection string** (URI format)
   - Set it as an environment variable:
     ```bash
     export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
     ```
   - Or create a `.env` file in the `server/` directory:
     ```
     DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
     ```

2. Navigate to the server directory:
```bash
cd server
```

3. Install dependencies:
```bash
npm install
```

4. Run the backend server:
```bash
npm run dev
```

The backend API will be available at `http://localhost:3001`

**Note:** The app now uses PostgreSQL (Supabase) instead of SQLite for persistent, cloud-hosted data. If `DATABASE_URL` is not set, the app will fail to start.

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

## Deploy on Railway

For the **backend** on Railway (same idea as Render):

1. **Dashboard → New Project → Deploy from GitHub** → connect `Salino-skool`.
2. **Add a service** → choose the repo.
3. **Critical:** In **Settings → Root Directory**, set `server`.  
   Without this, Railway builds the frontend (root) instead of the backend; the app has no `start` script and will crash.
4. **Environment Variables:** Add `DATABASE_URL` from your Supabase project (Settings → Database → Connection string).
5. **Build command:** `npm install && npm run build`  
6. **Start command:** `npm start`  
7. Deploy. Use the generated URL (e.g. `https://salino-api-production-xxx.up.railway.app`) + `/api` for `VITE_API_URL` in Netlify.

---

## 🚀 Deploy Everything on Netlify (Recommended - No Render/Railway Needed!)

**You can now deploy the entire app on Netlify - both frontend AND backend!** No need for Render or Railway.

### Quick Setup:

1. **Create Supabase Project** (for database):
   - Go to [Supabase](https://supabase.com) and create a free account
   - Create a new project
   - Go to **Settings → Database** and copy the **Connection string** (URI format)
   - Also copy your **Project URL** and **anon/public key** from **Settings → API**

2. **Set up Supabase Storage** (optional, for file uploads):
   - In Supabase Dashboard → **Storage**
   - The bucket `course-resources` will be created automatically on first upload
   - Or create it manually and set it to **Private** (we use signed URLs)

3. **Deploy to Netlify**:
   - Push your code to GitHub
   - Go to [Netlify](https://netlify.com) → **Add new site** → **Import from Git**
   - Connect your GitHub repo
   - **Build settings:**
     - Build command: `npm run build`
     - Publish directory: `dist`
   - **Environment variables** (Site settings → Environment variables):
     
     Here's where to find each value in Supabase:
     
     ### 1. DATABASE_URL
     - Go to your Supabase project dashboard
     - Click **Settings** (gear icon) → **Database**
     - Scroll down to **Connection string** section
     - Select **URI** tab
     - Copy the connection string (it looks like: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`)
     - **Important:** Replace `[PASSWORD]` with your actual database password (set when creating the project, or reset it in Settings → Database → Database password)
     - Use the **Connection pooling** URI (port 6543) for better performance, or the **Direct connection** (port 5432) if pooling doesn't work
     
     ### 2. SUPABASE_URL
     - In Supabase dashboard → **Settings** → **API**
     - Find **Project URL** (looks like: `https://[PROJECT-REF].supabase.co`)
     - Copy this entire URL
     
     ### 3. SUPABASE_ANON_KEY
     - In the same **Settings** → **API** page
     - Find **Project API keys** section
     - Copy the **anon** `public` key (the long string starting with `eyJ...`)
     - This is safe to expose in frontend code, but keep it in environment variables for security
     
     ### 4. JWT_SECRET
     - This is **NOT from Supabase** - you create this yourself!
     - It's a random secret string used to sign JWT tokens for authentication
     - Generate a random string (any length, but 32+ characters is recommended):
       - **Option A:** Use an online generator: https://randomkeygen.com/ (use "CodeIgniter Encryption Keys")
       - **Option B:** Run in terminal: `openssl rand -base64 32`
       - **Option C:** Just use any random string like `my-super-secret-jwt-key-2024`
     - Keep this secret - don't share it publicly!
     
     **Example values** (yours will be different):
     ```
     DATABASE_URL=postgresql://postgres.abcdefghijklmnop:MyPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres
     SUPABASE_URL=https://abcdefghijklmnop.supabase.co
     SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NjE2ODAwMCwiZXhwIjoxOTYxNzQ0MDAwfQ.example
     JWT_SECRET=my-super-secret-jwt-key-change-this-to-something-random-12345
     ```
     - **Optional:** Set `FORCE_COURSE_STRUCTURE=true` once if courses still show placeholder videos or missing lessons; it re-applies all course structures and real video URLs, then you can remove it.
     
     **Note:** You don't need `VITE_API_URL` anymore! The frontend uses relative `/api` URLs that are automatically proxied to Netlify Functions.
   - Click **Deploy site**

4. **That's it!** Your full-stack app is now live:
   - Frontend: `https://your-site.netlify.app`
   - Backend API: `https://your-site.netlify.app/api/*` (handled by Netlify Functions)

### How It Works:

- **Frontend**: Built with Vite and served as a static site
- **Backend**: Express app wrapped as a Netlify Function (serverless) - no separate hosting needed!
- **Database**: PostgreSQL on Supabase (persistent, cloud-hosted)
- **File Storage**: Supabase Storage (if configured) or `/tmp` (temporary fallback)

### Default Login:

After first deploy, the default admin user is created:
- Email: `test@salino.com`
- Password: `test123`

---

## Deploy on Render (Dashboard) - Legacy Option

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

## Backend connection troubleshooting

If the frontend can't reach the backend (login fails, "Backend not reachable", or timeout):

1. **VITE_API_URL** must be set in the **build** environment (Netlify → Site settings → Environment variables). It’s read at build time.
   - Value: `https://YOUR-RENDER-API.onrender.com/api` (include `/api`)
   - Rebuild after changing env vars.

2. **Render backend URL** – Copy it from the Render dashboard (e.g. `https://salino-api.onrender.com`). Use that + `/api` for VITE_API_URL.

3. **Render free tier sleep** – Services sleep after ~15 min of no traffic. The first request may take 30–60 seconds. Try again after waiting.

4. **Verify the API** – In a browser, open `https://YOUR-RENDER-API.onrender.com/api/health`. You should see `{"status":"ok",...}`. If it errors or times out, the backend is down or sleeping.

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



postgresql://postgres:PoligyRulez2018@db.hwxjwjmlkuramaxpnksk.supabase.co:5432/postgres
   SUPABASE_URL = https://hwxjwjmlkuramaxpnksk.supabase.co

   SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3eGp3am1sa3VyYW1heHBua3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDI5NTUsImV4cCI6MjA4NjkxODk1NX0.1N7K2sUVlXCTMgAR8h57sv6FiEdaNrnmpsgcfNF4zVM
   
   JWT_SECRET = zZ8I4Sk0z/yzVG0fKAkKufWfnhqteYluoKXjvhpbOtQ=