// Supabase Storage helper for file uploads/downloads
// This replaces local filesystem storage for serverless compatibility
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL and SUPABASE_ANON_KEY not set. File uploads will not work.')
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

const BUCKET_NAME = 'course-resources'

// Ensure bucket exists (run once)
export async function ensureBucket() {
  if (!supabase) return
  
  try {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) throw error
    
    const bucketExists = data?.some(b => b.name === BUCKET_NAME)
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false, // Private bucket, we'll generate signed URLs
      })
      if (createError) {
        console.error('Error creating bucket:', createError)
      } else {
        console.log(`Created storage bucket: ${BUCKET_NAME}`)
      }
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error)
  }
}

// Upload file to Supabase Storage
export async function uploadFile(
  file: Express.Multer.File,
  fileName: string
): Promise<{ path: string; url: string } | null> {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Set SUPABASE_URL and SUPABASE_ANON_KEY.')
  }

  await ensureBucket()

  // Ensure we have a buffer (multer memory storage provides this)
  const fileBuffer = file.buffer || Buffer.from('')
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, fileBuffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false,
    })

  if (error) {
    console.error('Error uploading file:', error)
    throw error
  }

  // Generate a signed URL (valid for 1 year)
  const { data: urlData } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(fileName, 60 * 60 * 24 * 365)

  return {
    path: data.path,
    url: urlData?.signedUrl || '',
  }
}

// Get signed URL for file download
export async function getFileUrl(fileName: string, expiresIn: number = 3600): Promise<string | null> {
  if (!supabase) return null

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(fileName, expiresIn)

  if (error) {
    console.error('Error generating signed URL:', error)
    return null
  }

  return data?.signedUrl || null
}

// Delete file from storage
export async function deleteFile(fileName: string): Promise<boolean> {
  if (!supabase) return false

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([fileName])

  if (error) {
    console.error('Error deleting file:', error)
    return false
  }

  return true
}
