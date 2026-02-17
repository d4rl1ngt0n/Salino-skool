// Netlify Function wrapper for Express backend
// This allows us to run the entire Express app as a serverless function on Netlify
import serverless from 'serverless-http'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase } from '../../server/src/database/init.js'
import authRoutes from '../../server/src/routes/auth.js'
import courseRoutes from '../../server/src/routes/courses.js'
import userRoutes from '../../server/src/routes/users.js'
import resourcesRoutes from '../../server/src/routes/resources.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Set NETLIFY env var so routes know we're in serverless mode
process.env.NETLIFY = 'true'

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
if (!dbInitialized) {
  initDatabase().catch(console.error)
  dbInitialized = true
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

// Export the serverless-wrapped Express app
export const handler = serverless(app)
