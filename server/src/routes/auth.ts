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
      [userId, name, email, hashedPassword, false]
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

    console.log('Login attempt for email:', email)

    // Find user
    let user: any
    try {
      user = await dbGet('SELECT * FROM users WHERE email = ?', [email]) as any
      console.log('User lookup result:', user ? 'Found' : 'Not found')
    } catch (dbError: any) {
      console.error('Database query error:', dbError)
      console.error('Error details:', {
        message: dbError?.message,
        code: dbError?.code,
        stack: dbError?.stack
      })
      return res.status(500).json({ 
        error: 'Database error', 
        message: dbError?.message || 'Failed to query database'
      })
    }

    if (!user) {
      console.log('User not found for email:', email)
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Verify password
    let isValid = false
    try {
      isValid = await bcrypt.compare(password, user.password)
      console.log('Password verification:', isValid ? 'Valid' : 'Invalid')
    } catch (bcryptError: any) {
      console.error('Password comparison error:', bcryptError)
      return res.status(500).json({ error: 'Password verification failed' })
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const userData = { 
      id: user.id, 
      name: user.name, 
      email: user.email,
      isAdmin: user.is_admin === true 
    }
    
    let token: string
    try {
      token = generateToken(userData)
      console.log('Token generated successfully')
    } catch (tokenError: any) {
      console.error('Token generation error:', tokenError)
      console.error('JWT_SECRET present:', !!process.env.JWT_SECRET)
      return res.status(500).json({ error: 'Token generation failed' })
    }

    res.json({ user: userData, token })
  } catch (error: any) {
    console.error('Login error:', error)
    console.error('Error stack:', error?.stack)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    })
  }
})

export default router
