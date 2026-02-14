# Troubleshooting Login Issues

## Common Issues and Solutions

### 1. Backend Server Not Running

**Symptom:** Error message "Cannot connect to server" or "Network error"

**Solution:**
1. Make sure the backend server is running:
   ```bash
   cd server
   npm install
   npm run dev
   ```
2. You should see: `Server running on http://localhost:3001`
3. Check that the server is accessible by visiting: `http://localhost:3001/api/health`

### 2. Database Not Initialized

**Symptom:** Login fails even with correct credentials

**Solution:**
1. Delete the database file if it exists: `server/data/salino.db`
2. Restart the backend server - it will recreate the database and default user
3. Check the console for: "Default test user created"

### 3. CORS Issues

**Symptom:** Network errors in browser console

**Solution:**
- The backend already has CORS enabled, but if you see CORS errors:
  1. Make sure the frontend is running on the expected port (5173)
  2. Check that `VITE_API_URL` in `.env` matches the backend URL

### 4. Wrong API URL

**Symptom:** All API calls fail

**Solution:**
1. Create a `.env` file in the root directory:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```
2. Restart the frontend dev server after creating/updating `.env`

### 5. Default Test Account Not Created

**Symptom:** Can't login with test@salino.com

**Solution:**
1. Stop the backend server
2. Delete `server/data/salino.db`
3. Restart the backend server
4. Check console for "Default test user created"

## Testing the Backend

You can test the backend API directly using curl:

```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@salino.com","password":"test123"}'

# Test signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"newuser@test.com","password":"test123"}'
```

## Check Browser Console

Open browser DevTools (F12) and check:
1. **Console tab** - Look for error messages
2. **Network tab** - Check if API requests are being made and their responses
3. Look for CORS errors or 404/500 errors

## Default Test Account

- **Email:** `test@salino.com`
- **Password:** `test123`

This account is created automatically when the database is first initialized.
