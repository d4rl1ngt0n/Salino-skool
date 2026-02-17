// Netlify Function wrapper for Express backend
// This allows us to run the entire Express app as a serverless function on Netlify

// CRITICAL: Set NETLIFY env var BEFORE importing any routes
// Routes use this to avoid import.meta.url (which is undefined in CJS bundle)
process.env.NETLIFY = 'true'

import serverless from 'serverless-http'
import express from 'express'
import cors from 'cors'

// Note: Environment variables are provided by Netlify via process.env
// No need for dotenv - Netlify automatically injects env vars from dashboard

import { initDatabase } from '../../server/src/database/init.js'
import authRoutes from '../../server/src/routes/auth.js'
import courseRoutes from '../../server/src/routes/courses.js'
import userRoutes from '../../server/src/routes/users.js'
import resourcesRoutes from '../../server/src/routes/resources.js'

// Log environment status (for debugging) - only log if vars are set to avoid exposing values
console.log('Netlify Function starting...')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set ✓' : 'Missing ✗')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set ✓' : 'Missing ✗')
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set ✓' : 'Missing ✗')

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
      console.log('DATABASE_URL present:', !!process.env.DATABASE_URL)
      await initDatabase()
      console.log('Database initialized successfully')
      dbInitialized = true
    } catch (error: any) {
      console.error('Database initialization error:', error)
      console.error('Error message:', error?.message)
      console.error('Error stack:', error?.stack)
      // Don't throw - let routes handle the error
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

// Health check - NO database initialization needed, respond immediately
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Salino GmbH API is running',
    env: {
      database: process.env.DATABASE_URL ? 'configured' : 'missing',
      supabase: process.env.SUPABASE_URL ? 'configured' : 'missing',
      jwt: process.env.JWT_SECRET ? 'configured' : 'missing'
    }
  })
})

// 404 handler
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`)
  res.status(404).json({ error: 'Not found', method: req.method, path: req.originalUrl })
})

// Create the serverless handler
const serverlessHandler = serverless(app, {
  binary: ['image/*', 'application/pdf', 'application/octet-stream']
})

// Wrap handler with error handling and database initialization
const wrappedHandler = async (event: any, context: any) => {
  try {
    // Health check doesn't need database - respond immediately
    if (event.path === '/api/health' || event.path === '/.netlify/functions/api/health' || event.rawPath === '/api/health') {
      return serverlessHandler(event, context)
    }
    
    // For other routes, ensure database is initialized
    try {
      await ensureDatabaseInitialized()
      console.log('Database ready, handling request:', event.path)
    } catch (error: any) {
      console.error('Failed to initialize database:', error)
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      })
      // Return a proper error response instead of continuing
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Database initialization failed',
          message: error?.message || 'Unable to connect to database',
          details: process.env.NETLIFY_DEV ? error?.stack : undefined
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    }
    
    return await serverlessHandler(event, context)
  } catch (error: any) {
    console.error('Function handler error:', error)
    console.error('Error stack:', error?.stack)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
        // Only include stack in development
        ...(process.env.NETLIFY_DEV && { stack: error?.stack })
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }
}

// Export the serverless-wrapped Express app
export const handler = wrappedHandler
