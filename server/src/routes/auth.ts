import express from 'express'
import bcrypt from 'bcryptjs'
import { dbRun, dbGet } from '../database/init.js'
import { generateToken } from '../middleware/auth.js'

const router = express.Router()

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // Check if user exists
    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', [email])
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user (non-admin by default)
    const userId = Date.now().toString()
    await dbRun(
      'INSERT INTO users (id, name, email, password, is_admin) VALUES (?, ?, ?, ?, ?)',
      [userId, name, email, hashedPassword, 0]
    )

    const user = { id: userId, name, email, isAdmin: false }
    const token = generateToken(user)

    res.status(201).json({ user, token })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]) as any
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const userData = { 
      id: user.id, 
      name: user.name, 
      email: user.email,
      isAdmin: user.is_admin === 1 
    }
    const token = generateToken(userData)

    res.json({ user: userData, token })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
