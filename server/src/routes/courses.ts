import express from 'express'
import { dbAll, dbGet, dbRun } from '../database/init.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router = express.Router()

// Get all courses
router.get('/', async (req, res) => {
  try {
    const courses = await dbAll('SELECT * FROM courses ORDER BY order_index')
    
    // Get lessons for each course
    const coursesWithLessons = await Promise.all(
      (courses as any[]).map(async (course) => {
        const lessons = await dbAll(
          'SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index',
          [course.id]
        )
        return { ...course, lessons }
      })
    )

    res.json(coursesWithLessons)
  } catch (error) {
    console.error('Get courses error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get single course
router.get('/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params
    const course = await dbGet('SELECT * FROM courses WHERE id = ?', [courseId]) as any

    if (!course) {
      return res.status(404).json({ error: 'Course not found' })
    }

    const lessons = await dbAll(
      'SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index',
      [courseId]
    )

    res.json({ ...course, lessons })
  } catch (error) {
    console.error('Get course error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get lesson
router.get('/:courseId/lessons/:lessonId', async (req, res) => {
  try {
    const { courseId, lessonId } = req.params
    const lesson = await dbGet(
      'SELECT * FROM lessons WHERE id = ? AND course_id = ?',
      [lessonId, courseId]
    ) as any

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' })
    }

    res.json(lesson)
  } catch (error) {
    console.error('Get lesson error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get user progress for a course
router.get('/:courseId/progress', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { courseId } = req.params
    const userId = req.userId!

    const progress = await dbAll(
      `SELECT lesson_id, completed, completed_at 
       FROM course_progress 
       WHERE user_id = ? AND course_id = ?`,
      [userId, courseId]
    )

    res.json(progress)
  } catch (error) {
    console.error('Get progress error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update lesson progress
router.post('/:courseId/lessons/:lessonId/progress', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { courseId, lessonId } = req.params
    const { completed } = req.body
    const userId = req.userId!

    if (completed) {
      await dbRun(
        `INSERT INTO course_progress (id, user_id, course_id, lesson_id, completed, completed_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, course_id, lesson_id) 
         DO UPDATE SET completed = ?, completed_at = CURRENT_TIMESTAMP`,
        [`${userId}-${courseId}-${lessonId}`, userId, courseId, lessonId, 1, 1]
      )
    } else {
      await dbRun(
        `UPDATE course_progress 
         SET completed = 0, completed_at = NULL 
         WHERE user_id = ? AND course_id = ? AND lesson_id = ?`,
        [userId, courseId, lessonId]
      )
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Update progress error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get all user progress
router.get('/progress/all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!

    const progress = await dbAll(
      `SELECT course_id, lesson_id, completed, completed_at 
       FROM course_progress 
       WHERE user_id = ?`,
      [userId]
    )

    res.json(progress)
  } catch (error) {
    console.error('Get all progress error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Admin routes for course management

// Update lesson video URL - Admin only
router.put('/:courseId/lessons/:lessonId/video', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { courseId, lessonId } = req.params
    const { videoUrl } = req.body

    if (!videoUrl) {
      return res.status(400).json({ error: 'videoUrl is required' })
    }

    await dbRun(
      'UPDATE lessons SET video_url = ? WHERE id = ? AND course_id = ?',
      [videoUrl, lessonId, courseId]
    )

    const updatedLesson = await dbGet(
      'SELECT * FROM lessons WHERE id = ? AND course_id = ?',
      [lessonId, courseId]
    ) as any

    res.json(updatedLesson)
  } catch (error) {
    console.error('Update lesson video error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update lesson content - Admin only
router.put('/:courseId/lessons/:lessonId', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { courseId, lessonId } = req.params
    const { title, content, videoUrl } = req.body

    const updates: string[] = []
    const values: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      values.push(title)
    }
    if (content !== undefined) {
      updates.push('content = ?')
      values.push(content)
    }
    if (videoUrl !== undefined) {
      updates.push('video_url = ?')
      values.push(videoUrl)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    values.push(lessonId, courseId)
    await dbRun(
      `UPDATE lessons SET ${updates.join(', ')} WHERE id = ? AND course_id = ?`,
      values
    )

    const updatedLesson = await dbGet(
      'SELECT * FROM lessons WHERE id = ? AND course_id = ?',
      [lessonId, courseId]
    ) as any

    res.json(updatedLesson)
  } catch (error) {
    console.error('Update lesson error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update course - Admin only
router.put('/:courseId', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { courseId } = req.params
    const { title, description } = req.body

    const updates: string[] = []
    const values: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      values.push(title)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    values.push(courseId)
    await dbRun(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    const updatedCourse = await dbGet('SELECT * FROM courses WHERE id = ?', [courseId]) as any
    const lessons = await dbAll(
      'SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index',
      [courseId]
    )

    res.json({ ...updatedCourse, lessons })
  } catch (error) {
    console.error('Update course error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
