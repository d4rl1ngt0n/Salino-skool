// Netlify Function wrapper for Express backend
// This allows us to run the entire Express app as a serverless function on Netlify
import serverless from 'serverless-http'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Load environment variables (Netlify provides these, but dotenv helps with local testing)
import { config } from 'dotenv'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Try to load .env from server directory (for local testing)
try {
  config({ path: path.resolve(__dirname, '../../server/.env') })
} catch (e) {
  // Ignore if .env doesn't exist (Netlify will use env vars from dashboard)
}

import { initDatabase } from '../../server/src/database/init.js'
import authRoutes from '../../server/src/routes/auth.js'
import courseRoutes from '../../server/src/routes/courses.js'
import userRoutes from '../../server/src/routes/users.js'
import resourcesRoutes from '../../server/src/routes/resources.js'

// Set NETLIFY env var so routes know we're in serverless mode
process.env.NETLIFY = 'true'

// Log environment status (for debugging)
console.log('Netlify Function starting...')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing')

const app = express()

// CORS: allow all origins
app.use(cors({ origin: true, optionsSuccessStatus: 204, credentials: false }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Handle CORS preflight
app.options('/api/*', (req, res) => res.sendStatus(204))

// Log API requests
app.use('/api', (req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`)
  next()
})

// Initialize database (runs once per cold start)
let dbInitialized = false
let dbInitPromise: Promise<void> | null = null

async function ensureDatabaseInitialized() {
  if (dbInitialized) return
  if (dbInitPromise) return dbInitPromise
  
  dbInitPromise = (async () => {
    try {
      console.log('Initializing database...')
      await initDatabase()
      console.log('Database initialized successfully')
      dbInitialized = true
    } catch (error) {
      console.error('Database initialization error:', error)
      throw error
    }
  })()
  
  return dbInitPromise
}

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/users', userRoutes)
app.use('/api/resources', resourcesRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Salino GmbH API is running' })
})

// 404 handler
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`)
  res.status(404).json({ error: 'Not found', method: req.method, path: req.originalUrl })
})

// Create the serverless handler
const serverlessHandler = serverless(app)

// Wrap handler with database initialization
const wrappedHandler = async (event: any, context: any) => {
  try {
    await ensureDatabaseInitialized()
  } catch (error) {
    console.error('Failed to initialize database:', error)
    // Still try to handle the request, but log the error
  }
  return serverlessHandler(event, context)
}

// Export the serverless-wrapped Express app
export const handler = wrappedHandler
