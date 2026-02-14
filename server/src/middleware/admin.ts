import { Request, Response, NextFunction } from 'express'
import { dbGet } from '../database/init.js'
import { AuthRequest } from './auth.js'

export interface AdminRequest extends AuthRequest {
  user: {
    id: string
    email: string
    name: string
    isAdmin: boolean
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authReq = req as AuthRequest
    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Check if user is admin
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [authReq.user.id]) as any
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Attach admin user info to request
    const adminReq = req as AdminRequest
    adminReq.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: true,
    }

    next()
  } catch (error) {
    console.error('Admin check error:', error)
    res.status(500).json({ error: 'Failed to verify admin access' })
  }
}
