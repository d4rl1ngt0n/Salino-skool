import express from 'express'
import { dbAll, dbGet, dbRun } from '../database/init.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, writeFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { uploadFile, getFileUrl } from '../storage/supabase.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// For serverless: use /tmp (Netlify Functions) or fallback to local uploads
const uploadsDir = process.env.NETLIFY 
  ? '/tmp/uploads' 
  : path.join(__dirname, '../../uploads')

try {
  mkdirSync(uploadsDir, { recursive: true })
} catch (error) {
  // Directory might already exist
}

// Use memory storage for serverless compatibility (files stored in memory, then saved)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types
    cb(null, true)
  },
})

// Get all resources (optionally filtered by course_id) - All authenticated users can view
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { course_id, lesson_id } = req.query

    let query = 'SELECT * FROM resources WHERE 1=1'
    const params: any[] = []

    if (course_id) {
      query += ' AND course_id = ?'
      params.push(course_id)
    }

    // When lesson_id is provided, include both that lesson's resources and course-level (NULL) resources
    if (lesson_id) {
      query += ' AND (lesson_id = ? OR lesson_id IS NULL)'
      params.push(lesson_id)
    }

    query += ' ORDER BY created_at DESC'

    const resources = await dbAll(query, params) as any[]

    // Transform resources to include type and appropriate URLs
    const transformedResources = resources.map((resource) => {
      const baseResource = {
        id: resource.id,
        courseId: resource.course_id,
        lessonId: resource.lesson_id,
        title: resource.title,
        description: resource.description,
        resourceType: resource.resource_type || 'file',
        uploadedBy: resource.uploaded_by,
        createdAt: resource.created_at,
      }

      if (resource.resource_type === 'url') {
        return {
          ...baseResource,
          externalUrl: resource.external_url,
        }
      } else {
        return {
          ...baseResource,
          fileUrl: `/api/resources/files/${resource.id}`,
          fileName: resource.file_name,
          savedFileName: resource.saved_file_name,
          fileSize: resource.file_size,
          fileType: resource.file_type,
        }
      }
    })

    res.json({ data: transformedResources })
  } catch (error) {
    console.error('Error fetching resources:', error)
    res.status(500).json({ error: 'Failed to fetch resources' })
  }
})

// Get a single resource - All authenticated users can view
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const resource = await dbGet('SELECT * FROM resources WHERE id = ?', [req.params.id]) as any

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' })
    }

    const baseResource = {
      id: resource.id,
      courseId: resource.course_id,
      lessonId: resource.lesson_id,
      title: resource.title,
      description: resource.description,
      resourceType: resource.resource_type || 'file',
      uploadedBy: resource.uploaded_by,
      createdAt: resource.created_at,
    }

    if (resource.resource_type === 'url') {
      res.json({
        data: {
          ...baseResource,
          externalUrl: resource.external_url,
        },
      })
    } else {
      res.json({
        data: {
          ...baseResource,
          fileUrl: `/api/resources/files/${resource.id}`,
          fileName: resource.file_name,
          savedFileName: resource.saved_file_name,
          fileSize: resource.file_size,
          fileType: resource.file_type,
        },
      })
    }
  } catch (error) {
    console.error('Error fetching resource:', error)
    res.status(500).json({ error: 'Failed to fetch resource' })
  }
})

// Upload a new resource - Admin only
// Handle both file uploads and URL resources
router.post('/', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { course_id, lesson_id, title, description, resource_type, external_url } = req.body
    const user = (req as any).user

    if (!course_id || !title) {
      return res.status(400).json({ error: 'course_id and title are required' })
    }

    const resourceId = uuidv4()
    const resourceType = resource_type || (req.file ? 'file' : 'url')

    if (resourceType === 'file') {
      // File upload
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const savedFileName = `${uuidv4()}-${req.file.originalname}`
      let fileUrl = `/api/resources/files/${resourceId}`

      // Try Supabase Storage first (if configured), otherwise use local storage
      try {
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
          // Convert buffer to Express.Multer.File-like object
          const fileForSupabase = {
            ...req.file,
            buffer: req.file.buffer,
          } as Express.Multer.File
          
          const uploadResult = await uploadFile(fileForSupabase, savedFileName)
          if (uploadResult) {
            fileUrl = uploadResult.url // Use Supabase signed URL
          }
        } else {
          // Fallback: save to local filesystem (/tmp for serverless)
          const filePath = path.join(uploadsDir, savedFileName)
          writeFileSync(filePath, req.file.buffer)
        }
      } catch (error) {
        console.error('Error uploading file:', error)
        // Fallback to local storage
        const filePath = path.join(uploadsDir, savedFileName)
        writeFileSync(filePath, req.file.buffer)
      }

      await dbRun(
        `INSERT INTO resources (id, course_id, lesson_id, title, description, resource_type, file_url, file_name, saved_file_name, file_size, file_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resourceId,
          course_id,
          lesson_id || null,
          title,
          description || null,
          'file',
          fileUrl,
          req.file.originalname,
          savedFileName,
          req.file.size,
          req.file.mimetype,
          user.id,
        ]
      )

      res.status(201).json({
        data: {
          id: resourceId,
          courseId: course_id,
          lessonId: lesson_id || null,
          title,
          description: description || null,
          resourceType: 'file',
          fileUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          uploadedBy: user.id,
          createdAt: new Date().toISOString(),
        },
      })
    } else {
      // URL resource
      if (!external_url) {
        return res.status(400).json({ error: 'external_url is required for URL resources' })
      }

      // Validate URL format
      try {
        new URL(external_url)
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' })
      }

      await dbRun(
        `INSERT INTO resources (id, course_id, lesson_id, title, description, resource_type, file_url, file_name, external_url, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resourceId,
          course_id,
          lesson_id || null,
          title,
          description || null,
          'url',
          null, // file_url is NULL for URL resources
          null, // file_name is NULL for URL resources
          external_url,
          user.id,
        ]
      )

      res.status(201).json({
        data: {
          id: resourceId,
          courseId: course_id,
          lessonId: lesson_id || null,
          title,
          description: description || null,
          resourceType: 'url',
          externalUrl: external_url,
          uploadedBy: user.id,
          createdAt: new Date().toISOString(),
        },
      })
    }
  } catch (error) {
    console.error('Error uploading resource:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({ error: `Failed to upload resource: ${errorMessage}` })
  }
})

// Download/access a resource file - All authenticated users can download
router.get('/files/:id', authenticateToken, async (req, res) => {
  try {
    const resource = await dbGet('SELECT * FROM resources WHERE id = ?', [req.params.id]) as any

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' })
    }

    // If file_url is a Supabase URL, redirect to it
    if (resource.file_url && resource.file_url.startsWith('http')) {
      return res.redirect(resource.file_url)
    }

    // Otherwise, try to get from Supabase Storage or local filesystem
    const fileName = resource.saved_file_name || resource.file_name
    
    // Try Supabase Storage first
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const signedUrl = await getFileUrl(fileName)
      if (signedUrl) {
        return res.redirect(signedUrl)
      }
    }

    // Fallback: local filesystem
    const filePath = path.join(uploadsDir, fileName)
    const fs = await import('fs')
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' })
    }

    res.download(filePath, resource.file_name, (err) => {
      if (err) {
        console.error('Error downloading file:', err)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file' })
        }
      }
    })
  } catch (error) {
    console.error('Error accessing resource file:', error)
    res.status(500).json({ error: 'Failed to access resource file' })
  }
})

// Delete a resource - Admin only
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const resource = await dbGet('SELECT * FROM resources WHERE id = ?', [req.params.id]) as any

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' })
    }

    const user = (req as any).user

    // Admin can delete any resource, or user can delete their own
    // requireAdmin middleware already ensures user is admin, so we can delete any resource

    // Delete the file from storage (only if it's a file resource)
    if (resource.resource_type !== 'url' && resource.saved_file_name) {
      const fileName = resource.saved_file_name || resource.file_name
      
      // Try Supabase Storage first
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        const { deleteFile } = await import('../storage/supabase.js')
        await deleteFile(fileName)
      } else {
        // Fallback: local filesystem
        const fs = await import('fs')
        const filePath = path.join(uploadsDir, fileName)
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
        } catch (error) {
          console.error('Error deleting file:', error)
        }
      }
    }

    // Delete from database
    await dbRun('DELETE FROM resources WHERE id = ?', [req.params.id])

    res.json({ message: 'Resource deleted successfully' })
  } catch (error) {
    console.error('Error deleting resource:', error)
    res.status(500).json({ error: 'Failed to delete resource' })
  }
})

export default router
