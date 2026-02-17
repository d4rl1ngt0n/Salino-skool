// Supabase Storage helper for file uploads/downloads
// This replaces local filesystem storage for serverless compatibility
import { createClient } from '@supabase/supabase-js'

// Lazy initialization to avoid errors if env vars aren't set
let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient
  
  let supabaseUrl = process.env.SUPABASE_URL || ''
  let supabaseKey = process.env.SUPABASE_ANON_KEY || ''

  // Clean up env vars - remove any "VAR_NAME = " prefix if accidentally included
  supabaseUrl = supabaseUrl.replace(/^SUPABASE_URL\s*=\s*/i, '').trim()
  supabaseKey = supabaseKey.replace(/^SUPABASE_ANON_KEY\s*=\s*/i, '').trim()

  // Validate URL format before creating client
  if (!supabaseUrl || !supabaseKey) {
    console.warn('SUPABASE_URL and SUPABASE_ANON_KEY not set. File uploads will not work.')
    return null
  }

  // Validate URL is a valid HTTP/HTTPS URL
  try {
    const url = new URL(supabaseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      console.warn(`Invalid SUPABASE_URL protocol: ${url.protocol}. Must be http:// or https://`)
      return null
    }
  } catch (error) {
    console.warn(`Invalid SUPABASE_URL format: ${supabaseUrl}`, error)
    return null
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey)
    return supabaseClient
  } catch (error) {
    console.error('Error creating Supabase client:', error)
    return null
  }
}

export const supabase = getSupabaseClient()

const BUCKET_NAME = 'course-resources'

// Ensure bucket exists (run once)
export async function ensureBucket() {
  const client = getSupabaseClient()
  if (!client) return
  
  try {
    const { data, error } = await client.storage.listBuckets()
    if (error) throw error
    
    const bucketExists = data?.some(b => b.name === BUCKET_NAME)
    if (!bucketExists) {
      const { error: createError } = await client.storage.createBucket(BUCKET_NAME, {
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
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase client not initialized. Set SUPABASE_URL and SUPABASE_ANON_KEY.')
  }

  await ensureBucket()

  // Ensure we have a buffer (multer memory storage provides this)
  const fileBuffer = file.buffer || Buffer.from('')
  
  const { data, error } = await client.storage
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
  const { data: urlData } = await client.storage
    .from(BUCKET_NAME)
    .createSignedUrl(fileName, 60 * 60 * 24 * 365)

  return {
    path: data.path,
    url: urlData?.signedUrl || '',
  }
}

// Get signed URL for file download
export async function getFileUrl(fileName: string, expiresIn: number = 3600): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return null

  const { data, error } = await client.storage
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
  const client = getSupabaseClient()
  if (!client) return false

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .remove([fileName])

  if (error) {
    console.error('Error deleting file:', error)
    return false
  }

  return true
}
