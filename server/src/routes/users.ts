import express from 'express'
import { dbGet } from '../database/init.js'
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

export default router
