import express from 'express'
import { dbGet, dbAll } from '../database/init.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

// Get current user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await dbGet('SELECT id, name, email, is_admin, created_at FROM users WHERE id = ?', [userId]) as any

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin === true,
      createdAt: user.created_at,
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// List all admin users (for debugging - no auth required for now, but you can add requireAdmin if needed)
router.get('/admins', async (req, res) => {
  try {
    const admins = await dbAll('SELECT id, name, email, is_admin, created_at FROM users WHERE is_admin = true ORDER BY created_at') as any[]
    res.json({
      count: admins.length,
      admins: admins.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        isAdmin: u.is_admin === true,
        createdAt: u.created_at,
      })),
    })
  } catch (error) {
    console.error('Get admins error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
