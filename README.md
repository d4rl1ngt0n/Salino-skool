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
