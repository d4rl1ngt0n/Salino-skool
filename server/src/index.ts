import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase } from './database/init.js'
import authRoutes from './routes/auth.js'
import courseRoutes from './routes/courses.js'
import userRoutes from './routes/users.js'
import resourcesRoutes from './routes/resources.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware – CORS first so preflight OPTIONS gets 2xx
app.use(cors({ optionsSuccessStatus: 204 }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Handle CORS preflight for all /api routes (some setups need this)
app.options('/api/*', (req, res) => res.sendStatus(204))

// Log API requests to confirm they reach the backend
app.use('/api', (req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`)
  next()
})

// Initialize database
initDatabase()

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/users', userRoutes)
app.use('/api/resources', resourcesRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Salino GmbH API is running' })
})

// 404 logger – if you see this for POST /api/auth/login, the route isn’t matching
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`)
  res.status(404).json({ error: 'Not found', method: req.method, path: req.originalUrl })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
