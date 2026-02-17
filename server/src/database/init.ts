import { Pool, QueryResult } from 'pg'
import bcrypt from 'bcryptjs'

// PostgreSQL connection pool (Supabase provides DATABASE_URL)
// Clean up DATABASE_URL - remove any "VAR_NAME = " prefix if accidentally included
let databaseUrl = process.env.DATABASE_URL || ''
databaseUrl = databaseUrl.replace(/^DATABASE_URL\s*=\s*/i, '').trim()

if (!databaseUrl) {
  console.error('DATABASE_URL is not set!')
  throw new Error('DATABASE_URL environment variable is required')
}

// Validate DATABASE_URL format
if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error('Invalid DATABASE_URL format. Should start with postgresql:// or postgres://')
  console.error('Current value (first 50 chars):', databaseUrl.substring(0, 50))
  throw new Error('Invalid DATABASE_URL format. Must start with postgresql://')
}

console.log('Connecting to database...')
console.log('DATABASE_URL format check:', databaseUrl.substring(0, 50) + '...')
console.log('DATABASE_URL hostname:', databaseUrl.match(/@([^:]+)/)?.[1] || 'unknown')

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 30000, // 30 second timeout (longer for cold starts)
  idleTimeoutMillis: 30000,
  max: 2, // Limit connections for serverless
})

pool.on('error', (err) => {
  console.error('Unexpected database error:', err)
})

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database (Supabase)')
})

// Helper to convert SQLite-style ? placeholders to PostgreSQL $1, $2, $3 format
// Also converts SQLite-specific syntax to PostgreSQL
function convertPlaceholders(sql: string): string {
  let paramIndex = 1
  let converted = sql.replace(/\?/g, () => `$${paramIndex++}`)
  
  // Convert INSERT OR REPLACE to INSERT ... ON CONFLICT DO UPDATE
  // Handle both simple and complex cases
  converted = converted.replace(
    /INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi,
    (match, table, columns, values) => {
      // Extract primary key column (usually 'id')
      const pkCol = columns.split(',')[0].trim()
      // Build UPDATE clause for all columns
      const updateCols = columns.split(',').map((col: string) => {
        const colName = col.trim()
        return `${colName} = EXCLUDED.${colName}`
      }).join(', ')
      return `INSERT INTO ${table} (${columns}) VALUES (${values}) ON CONFLICT (${pkCol}) DO UPDATE SET ${updateCols}`
    }
  )
  
  return converted
}

// Typed wrappers compatible with existing code
export interface RunResult {
  rowCount: number
}

export async function dbRun(sql: string, params?: unknown[]): Promise<RunResult> {
  const pgSql = convertPlaceholders(sql)
  const result = await pool.query(pgSql, params)
  return { rowCount: result.rowCount || 0 }
}

export async function dbGet<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined> {
  const pgSql = convertPlaceholders(sql)
  const result = await pool.query(pgSql, params)
  return (result.rows[0] as T) || undefined
}

export async function dbAll<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const pgSql = convertPlaceholders(sql)
  const result = await pool.query(pgSql, params)
  return result.rows as T[]
}

export const db = pool // For compatibility if anything references db directly

export async function initDatabase() {
  try {
    // Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Courses table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        order_index INTEGER NOT NULL,
        thumbnail_url TEXT
      )
    `)

    // Lessons table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS lessons (
        id VARCHAR(255) PRIMARY KEY,
        course_id VARCHAR(255) NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        video_url TEXT,
        order_index INTEGER NOT NULL,
        section TEXT,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      )
    `)

    // Course progress table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS course_progress (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        course_id VARCHAR(255) NOT NULL,
        lesson_id VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
        UNIQUE(user_id, course_id, lesson_id)
      )
    `)

    // Resources table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS resources (
        id VARCHAR(255) PRIMARY KEY,
        course_id VARCHAR(255) NOT NULL,
        lesson_id VARCHAR(255),
        title TEXT NOT NULL,
        description TEXT,
        resource_type VARCHAR(50) DEFAULT 'file',
        file_url TEXT,
        file_name TEXT,
        saved_file_name TEXT,
        file_size BIGINT,
        file_type VARCHAR(100),
        external_url TEXT,
        uploaded_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Init flags table (for one-time migrations)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS init_flags (
        name VARCHAR(255) PRIMARY KEY
      )
    `)
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }

  // Run migrations first so section/thumbnail columns exist before structure updates
  await migrateDatabase().catch((e) => { console.error('migrateDatabase:', e) })
  await migrateResourcesTable().catch((e) => { console.error('migrateResourcesTable:', e) })
  await migrateLessonsSection().catch((e) => { console.error('migrateLessonsSection:', e) })
  await migrateCoursesThumbnail().catch((e) => { console.error('migrateCoursesThumbnail:', e) })

  // Insert sample courses first so all 15 courses exist, then apply full lesson lists and real videos
  await insertSampleData().catch((e) => { console.error('insertSampleData:', e) })
  await insertDefaultUser().catch((e) => { console.error('insertDefaultUser:', e) })
  await applyCourseStructuresOnce().catch((e) => { console.error('applyCourseStructuresOnce:', e) })
}

async function migrateDatabase() {
  try {
    // Check if is_admin column exists (PostgreSQL)
    const result = await dbGet<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_admin'
      ) as exists
    `)
    const hasAdminColumn = result?.exists === true
    
    if (!hasAdminColumn) {
      console.log('Migrating database: Adding is_admin column to users table...')
      await dbRun('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE')
      console.log('Migration complete: is_admin column added')
    }
  } catch (error) {
    console.error('Error migrating database:', error)
  }
}

async function migrateResourcesTable() {
  try {
    // Check columns exist (PostgreSQL)
    const columns = await dbAll<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'resources'
    `)
    const columnNames = columns.map((c) => c.column_name)
    
    if (!columnNames.includes('saved_file_name')) {
      console.log('Migrating database: Adding saved_file_name column to resources table...')
      await dbRun('ALTER TABLE resources ADD COLUMN saved_file_name TEXT')
      console.log('Migration complete: saved_file_name column added to resources table')
    }
    
    if (!columnNames.includes('resource_type')) {
      console.log('Migrating database: Adding resource_type column to resources table...')
      await dbRun("ALTER TABLE resources ADD COLUMN resource_type VARCHAR(50) DEFAULT 'file'")
      console.log('Migration complete: resource_type column added to resources table')
    }
    
    if (!columnNames.includes('external_url')) {
      console.log('Migrating database: Adding external_url column to resources table...')
      await dbRun('ALTER TABLE resources ADD COLUMN external_url TEXT')
      console.log('Migration complete: external_url column added to resources table')
    }
    
    // PostgreSQL allows dropping NOT NULL directly
    const fileUrlCol = await dbGet<{ is_nullable: string }>(`
      SELECT is_nullable FROM information_schema.columns 
      WHERE table_name = 'resources' AND column_name = 'file_url'
    `)
    if (fileUrlCol && fileUrlCol.is_nullable === 'NO') {
      console.log('Migrating database: Removing NOT NULL constraint from file_url column...')
      await dbRun('ALTER TABLE resources ALTER COLUMN file_url DROP NOT NULL')
      console.log('Migration complete: file_url NOT NULL constraint removed')
    }
  } catch (error) {
    console.error('Error migrating resources table:', error)
  }
}

async function migrateLessonsSection() {
  try {
    const result = await dbGet<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lessons' AND column_name = 'section'
      ) as exists
    `)
    const hasSectionColumn = result?.exists === true

    if (!hasSectionColumn) {
      console.log('Migrating database: Adding section column to lessons table...')
      await dbRun('ALTER TABLE lessons ADD COLUMN section TEXT')
      console.log('Migration complete: section column added to lessons table')
    }
  } catch (error) {
    console.error('Error migrating lessons section:', error)
  }
}

async function migrateCoursesThumbnail() {
  try {
    const result = await dbGet<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courses' AND column_name = 'thumbnail_url'
      ) as exists
    `)
    const hasThumbnailUrl = result?.exists === true

    if (!hasThumbnailUrl) {
      console.log('Migrating database: Adding thumbnail_url column to courses table...')
      await dbRun('ALTER TABLE courses ADD COLUMN thumbnail_url TEXT')
      console.log('Migration complete: thumbnail_url column added to courses table')
    }
  } catch (error) {
    console.error('Error migrating courses thumbnail:', error)
  }
}

// Run course structure updates (real video URLs) only once. After that, the DB is the source of truth
// so user-edited or admin-updated video URLs are never overwritten on server restart.
async function applyCourseStructuresOnce() {
  try {
    await dbRun('CREATE TABLE IF NOT EXISTS init_flags (name VARCHAR(255) PRIMARY KEY)')
    const forceApply = process.env.FORCE_COURSE_STRUCTURE === 'true' || process.env.FORCE_COURSE_STRUCTURE === '1'
    if (forceApply) {
      await dbRun("DELETE FROM init_flags WHERE name = 'course_structures_applied'")
      console.log('FORCE_COURSE_STRUCTURE set: re-applying all course structures')
    }

    const existing = await dbGet("SELECT 1 FROM init_flags WHERE name = 'course_structures_applied'") as any

    // Check if we have real videos (not placeholders) - count videos that are YouTube, Loom, Skool, or other real sources
    const realVideoCheck = await dbGet(
      `SELECT COUNT(*) as count FROM lessons 
       WHERE video_url IS NOT NULL 
       AND video_url != '' 
       AND (video_url LIKE '%youtu.be%' OR video_url LIKE '%youtube.com%' OR video_url LIKE '%loom.com%' OR video_url LIKE '%cdn.loom.com%' OR video_url LIKE '%skool.com%' OR video_url LIKE '%files.skool.com%')`
    ) as any
    const realVideoCount = Number(realVideoCheck?.count ?? 0)

    // Check placeholder count
    const placeholderCheck = await dbGet(
      `SELECT COUNT(*) as count FROM lessons WHERE video_url LIKE '%placeholder-video.com%'`
    ) as any
    const placeholderCount = Number(placeholderCheck?.count ?? 0)

    // Total lesson count
    const totalLessons = await dbGet('SELECT COUNT(*) as count FROM lessons') as any
    const lessonCount = Number(totalLessons?.count ?? 0)

    console.log(`Course structure check: ${realVideoCount} real videos, ${placeholderCount} placeholders, ${lessonCount} total lessons`)

    // If flag exists AND we have many real videos (>20), skip unless forced (preserve user edits)
    if (!forceApply && existing && realVideoCount > 20) {
      console.log('Course structures already applied with real videos; skipping to preserve user edits')
      return
    }

    // If we have placeholders or few real videos, apply structures
    if (forceApply || placeholderCount > 0 || realVideoCount < 20) {
      console.log('Applying course structures with real video URLs (replacing placeholders / filling missing lessons)...')
    }
    
    // Apply course structures (this will update videos and add missing lessons)
    await updateLessonsWithVideos()
    await updateSpecificLessonVideos()
    
    const structureUpdates = [
      updateCourse1Structure,
      updateCourse2Structure,
      updateCourse3Structure,
      updateCourse4Structure,
      updateCourse5Structure,
      updateCourse6Structure,
      updateCourse7Structure,
      updateCourse8Structure,
      updateCourse9Structure,
      updateCourse10Structure,
      updateCourse11Structure,
      updateCourse12Structure,
      updateCourse13Structure,
      updateCourse14Structure,
      updateCourse15Structure,
    ]
    
    let successCount = 0
    let errorCount = 0
    
    for (const updateFn of structureUpdates) {
      try {
        await updateFn()
        successCount++
        console.log(`✓ ${updateFn.name} completed`)
      } catch (error: any) {
        errorCount++
        console.error(`✗ Error in ${updateFn.name}:`, error?.message)
        console.error('Stack:', error?.stack?.substring(0, 300))
      }
    }
    
    await dbRun("INSERT INTO init_flags (name) VALUES ('course_structures_applied') ON CONFLICT (name) DO UPDATE SET name = 'course_structures_applied'")
    console.log(`Course structures applied: ${successCount} successful, ${errorCount} errors`)
    
    // Verify final counts
    const finalRealVideos = await dbGet(
      `SELECT COUNT(*) as count FROM lessons WHERE video_url IS NOT NULL AND video_url != '' AND (video_url LIKE '%youtu.be%' OR video_url LIKE '%youtube.com%' OR video_url LIKE '%loom.com%' OR video_url LIKE '%cdn.loom.com%' OR video_url LIKE '%skool.com%')`
    ) as any
    const totalAfter = await dbGet('SELECT COUNT(*) as count FROM lessons') as any
    console.log(`Final: ${finalRealVideos?.count ?? 0} lessons with real videos, ${totalAfter?.count ?? 0} total lessons`)
  } catch (error) {
    console.error('Error in applyCourseStructuresOnce:', error)
  }
}

async function insertSampleData() {
  try {
    // Check if all 15 courses exist (not just if any exist)
    const existingCourses = await dbAll('SELECT id FROM courses') as any[]
    const existingCourseIds = new Set(existingCourses.map(c => c.id))
    
    // If all 15 courses exist, skip insertion
    if (existingCourseIds.size >= 15) {
      console.log('All courses already exist, skipping sample data insertion')
      return
    }
    
    console.log(`Found ${existingCourseIds.size} existing courses, will insert missing ones`)
  } catch (error) {
    console.error('Error checking existing courses:', error)
    // Continue anyway - might be first run
  }

  const courses = [
    {
      id: '1',
      title: '01: Intro & Onboarding (Start here)',
      description: 'Salino GmbH - SOP Library',
      order: 1,
      lessons: [
        {
          id: '1-1',
          title: 'Willkommen & Next Steps',
          content: 'Welcome to Salino GmbH. In this lesson, you will learn about the onboarding process and next steps to get started.',
          order: 1,
        },
        {
          id: '1-2',
          title: 'Zugänge',
          content: 'Learn about accessing the platform and all available resources.',
          order: 2,
        },
        {
          id: '1-3',
          title: 'Status Quo & Strategy Call',
          content: 'In this lesson, we will discuss your current situation and develop a strategic plan moving forward. This is an important step to understand where you are and where you want to go.',
          order: 3,
        },
        {
          id: '1-4',
          title: 'Expectations & Zusammenarbeit',
          content: 'Understanding expectations and how we will work together effectively.',
          order: 4,
        },
      ],
    },
    {
      id: '2',
      title: 'Cold Friendly Offer - SOP Library',
      description: 'Salino GmbH - SOP Library',
      order: 2,
      lessons: [
        {
          id: '2-1',
          title: 'Understanding Cold Friendly Offers',
          content: 'Learn what makes an offer "cold friendly" and how to structure offers that work for cold traffic.',
          order: 1,
        },
        {
          id: '2-2',
          title: 'Offer Development Process',
          content: 'Step-by-step process for developing offers that convert with cold audiences.',
          order: 2,
        },
        {
          id: '2-3',
          title: 'Testing and Optimization',
          content: 'How to test and optimize your cold friendly offers for maximum performance.',
          order: 3,
        },
      ],
    },
    {
      id: '3',
      title: 'Cold Friendly Offer - SOP Library [US]',
      description: 'Salino GmbH - SOP Library',
      order: 3,
      lessons: [
        {
          id: '3-1',
          title: 'US Market Specifics',
          content: 'Understanding the unique characteristics of the US market for cold friendly offers.',
          order: 1,
        },
        {
          id: '3-2',
          title: 'US Offer Strategies',
          content: 'Specific strategies and tactics for developing offers in the US market.',
          order: 2,
        },
      ],
    },
    {
      id: '4',
      title: '02: Meta Ads - SOP Library',
      description: 'Salino GmbH - SOP Library',
      order: 4,
      lessons: [
        {
          id: '4-1',
          title: 'Meta Ads Platform Overview',
          content: 'Introduction to Meta advertising platform and its capabilities for business growth.',
          order: 1,
        },
        {
          id: '4-2',
          title: 'Campaign Structure',
          content: 'How to structure effective Meta ad campaigns from setup to optimization.',
          order: 2,
        },
        {
          id: '4-3',
          title: 'Audience Targeting',
          content: 'Master audience targeting strategies to reach the right people with your ads.',
          order: 3,
        },
        {
          id: '4-4',
          title: 'Ad Creative Best Practices',
          content: 'Learn how to create compelling ad creatives that drive conversions.',
          order: 4,
        },
        {
          id: '4-5',
          title: 'Budget Management',
          content: 'Effective budget allocation and management strategies for Meta campaigns.',
          order: 5,
        },
        {
          id: '4-6',
          title: 'Performance Analysis',
          content: 'How to analyze and interpret Meta Ads performance metrics.',
          order: 6,
        },
        {
          id: '4-7',
          title: 'Scaling Strategies',
          content: 'Proven strategies for scaling successful Meta ad campaigns.',
          order: 7,
        },
        {
          id: '4-8',
          title: 'Advanced Optimization',
          content: 'Advanced techniques for optimizing Meta ad campaigns for maximum ROI.',
          order: 8,
        },
        {
          id: '4-9',
          title: 'Troubleshooting Common Issues',
          content: 'How to identify and resolve common issues in Meta ad campaigns.',
          order: 9,
        },
      ],
    },
    {
      id: '5',
      title: '02: Facebook Ads - SOP Library [US]',
      description: 'Salino GmbH - SOP Library',
      order: 5,
      lessons: [
        {
          id: '5-1',
          title: 'Facebook Ads for US Market',
          content: 'Introduction to Facebook advertising specifically for the US market.',
          order: 1,
        },
        {
          id: '5-2',
          title: 'US Audience Insights',
          content: 'Understanding US audiences and how to target them effectively on Facebook.',
          order: 2,
        },
      ],
    },
    {
      id: '6',
      title: '03: Google Ads - SOP Library',
      description: 'Salino GmbH - SOP Library',
      order: 6,
      lessons: [
        {
          id: '6-1',
          title: 'Google Ads Fundamentals',
          content: 'Introduction to Google Ads platform and its core features.',
          order: 1,
        },
        {
          id: '6-2',
          title: 'Keyword Research',
          content: 'How to conduct effective keyword research for Google Ads campaigns.',
          order: 2,
        },
        {
          id: '6-3',
          title: 'Campaign Setup',
          content: 'Step-by-step guide to setting up your first Google Ads campaign.',
          order: 3,
        },
      ],
    },
    {
      id: '7',
      title: '03: Google Ads - SOP Library [US]',
      description: 'Salino GmbH - SOP Library',
      order: 7,
      lessons: [
        {
          id: '7-1',
          title: 'Google Ads for US Market',
          content: 'Getting started with Google Ads in the US market.',
          order: 1,
        },
      ],
    },
    {
      id: '8',
      title: '04: TikTok Ads - SOP Library',
      description: 'Salino GmbH - SOP Library',
      order: 8,
      lessons: [
        {
          id: '8-1',
          title: 'TikTok Ads Introduction',
          content: 'Introduction to TikTok advertising and its unique opportunities.',
          order: 1,
        },
      ],
    },
    {
      id: '9',
      title: '05 - 8 Figure Creative Frameworks & Processes',
      description: 'Salino GmbH - SOP Library',
      order: 9,
      lessons: [
        {
          id: '9-1',
          title: 'Creative Framework Overview',
          content: 'Introduction to proven creative frameworks used by 8-figure businesses.',
          order: 1,
        },
      ],
    },
    {
      id: '10',
      title: '05 - 8 Figure Creative Frameworks & Processes [US]',
      description: 'Salino GmbH - SOP Library',
      order: 10,
      lessons: [
        {
          id: '10-1',
          title: 'US Creative Frameworks',
          content: 'Creative frameworks specifically tailored for the US market.',
          order: 1,
        },
      ],
    },
    {
      id: '11',
      title: '06 - Direct Response',
      description: 'Salino GmbH - SOP Library',
      order: 11,
      lessons: [
        {
          id: '11-1',
          title: 'Direct Response Fundamentals',
          content: 'Understanding direct response marketing principles and strategies.',
          order: 1,
        },
      ],
    },
    {
      id: '12',
      title: '07: Brand Strategy - SOP Library',
      description: 'Salino GmbH - SOP Library',
      order: 12,
      lessons: [
        {
          id: '12-1',
          title: 'Brand Strategy Basics',
          content: 'Introduction to brand strategy and its importance in marketing.',
          order: 1,
        },
      ],
    },
    {
      id: '13',
      title: '08: Email Marketing - SOP Library',
      description: 'Salino GmbH - SOP Library',
      order: 13,
      lessons: [
        {
          id: '13-1',
          title: 'Email Marketing Fundamentals',
          content: 'Introduction to effective email marketing strategies and best practices.',
          order: 1,
        },
      ],
    },
    {
      id: '14',
      title: '09: CRO - SOP Library',
      description: 'Salino GmbH - SOP Library',
      order: 14,
      lessons: [
        {
          id: '14-1',
          title: 'Conversion Rate Optimization',
          content: 'Introduction to CRO principles and how to optimize your conversion rates.',
          order: 1,
        },
      ],
    },
    {
      id: '15',
      title: '13: Bulletproofing',
      description: 'Salino GmbH - SOP Library',
      order: 15,
      lessons: [
        {
          id: '15-1',
          title: 'Bulletproofing Your Business',
          content: 'Learn how to make your business more resilient and protected against common risks.',
          order: 1,
        },
      ],
    },
  ]

  // Get existing course IDs to avoid duplicates
  const existingCourses = await dbAll('SELECT id FROM courses').catch(() => []) as any[]
  const existingCourseIds = new Set(existingCourses.map(c => c.id))

  let insertedCount = 0
  let skippedCount = 0
  let errorCount = 0
  
  console.log(`Starting to insert ${courses.length} courses. ${existingCourseIds.size} already exist.`)
  
  for (const course of courses) {
    // Skip if course already exists
    if (existingCourseIds.has(course.id)) {
      console.log(`Course ${course.id} (${course.title}) already exists, skipping`)
      skippedCount++
      continue
    }

    try {
      console.log(`Inserting course ${course.id}: ${course.title} with ${course.lessons.length} lessons`)
      
      await dbRun(
        'INSERT INTO courses (id, title, description, order_index) VALUES (?, ?, ?, ?)',
        [course.id, course.title, course.description, course.order]
      )
      
      let lessonCount = 0
      for (const lesson of course.lessons) {
        // Add video URL placeholder for all lessons
        const videoUrl = `https://placeholder-video.com/${course.id}/${lesson.id}`
        await dbRun(
          'INSERT INTO lessons (id, course_id, title, content, video_url, order_index) VALUES (?, ?, ?, ?, ?, ?)',
          [lesson.id, course.id, lesson.title, lesson.content, videoUrl, lesson.order]
        )
        lessonCount++
      }
      
      insertedCount++
      console.log(`✓ Successfully inserted course ${course.id}: ${course.title} with ${lessonCount} lessons`)
    } catch (error: any) {
      errorCount++
      console.error(`✗ Error inserting course ${course.id} (${course.title}):`, error?.message)
      console.error('Error details:', {
        code: error?.code,
        errno: error?.errno,
        stack: error?.stack?.substring(0, 200)
      })
      // Continue with next course - don't let one failure stop all
    }
  }

  console.log(`Sample data insertion complete:`)
  console.log(`  - Inserted: ${insertedCount} courses`)
  console.log(`  - Skipped: ${skippedCount} courses (already exist)`)
  console.log(`  - Errors: ${errorCount} courses`)
  
  // Verify final count
  try {
    const finalCount = await dbGet('SELECT COUNT(*) as count FROM courses') as any
    console.log(`  - Total courses in database: ${finalCount?.count || 0}`)
  } catch (e) {
    console.error('Could not verify final course count:', e)
  }
}

async function updateLessonsWithVideos() {
  try {
    // Get all lessons that don't have video URLs
    const lessonsWithoutVideos = await dbAll(
      'SELECT id, course_id FROM lessons WHERE video_url IS NULL OR video_url = ""'
    ) as any[]

    if (lessonsWithoutVideos.length === 0) {
      return // All lessons already have videos
    }

    // Update each lesson with a video URL placeholder
    for (const lesson of lessonsWithoutVideos) {
      const videoUrl = `https://placeholder-video.com/${lesson.course_id}/${lesson.id}`
      await dbRun(
        'UPDATE lessons SET video_url = ? WHERE id = ?',
        [videoUrl, lesson.id]
      )
    }

    console.log(`Updated ${lessonsWithoutVideos.length} lessons with video placeholders`)
  } catch (error) {
    console.error('Error updating lessons with videos:', error)
  }
}

async function updateSpecificLessonVideos() {
  try {
    // Update "Status Quo & Strategy Call" lesson with the Loom video
    const loomVideoUrl = 'https://cdn.loom.com/sessions/thumbnails/78bd9fa43bb94c38b3479054edfece4c-00001.mp4'
    
    await dbRun(
      'UPDATE lessons SET video_url = ? WHERE title = ?',
      [loomVideoUrl, 'Status Quo & Strategy Call']
    )

    console.log('Updated "Status Quo & Strategy Call" lesson with Loom video')
  } catch (error) {
    console.error('Error updating specific lesson videos:', error)
  }
}

// Update Course 1 structure with actual video URLs
async function updateCourse1Structure() {
  try {
    const course1Lessons = [
      {
        id: '1-1',
        title: 'Willkommen & Next Steps',
        content: 'Welcome to Salino GmbH. In this lesson, you will learn about the onboarding process and next steps to get started.',
        order: 1,
        videoUrl: 'https://www.loom.com/share/34970ca7046749a0800568b77e109a4c',
      },
      {
        id: '1-2',
        title: 'Zugänge',
        content: 'Learn about accessing the platform and all available resources.',
        order: 2,
        videoUrl: 'https://www.loom.com/share/2afbc3dc50e64689aca68b0ac1b5162a',
      },
      {
        id: '1-3',
        title: 'Status Quo & Strategy Call',
        content: 'In this lesson, we will discuss your current situation and develop a strategic plan moving forward. This is an important step to understand where you are and where you want to go.',
        order: 3,
        videoUrl: 'https://www.loom.com/share/2afbc3dc50e64689aca68b0ac1b5162a',
      },
      {
        id: '1-4',
        title: 'Expectations & Zusammenarbeit',
        content: 'Understanding expectations and how we will work together effectively.',
        order: 4,
        videoUrl: 'https://youtu.be/K3kSsN9rMzc',
      },
    ]

    // Use INSERT ... ON CONFLICT to update existing lessons or insert new ones
    // This preserves any user-edited videos that aren't being updated
    for (const lesson of course1Lessons) {
      await dbRun(
        `INSERT INTO lessons (id, course_id, title, content, video_url, order_index) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           video_url = EXCLUDED.video_url,
           order_index = EXCLUDED.order_index`,
        [lesson.id, '1', lesson.title, lesson.content, lesson.videoUrl, lesson.order]
      )
    }
    
    console.log('Updated Course 1 structure with 4 lessons and actual video URLs')
  } catch (error) {
    console.error('Error updating Course 1 structure:', error)
  }
}

// Update Course 2 structure with actual lesson titles
async function updateCourse2Structure() {
  try {
    const course2Lessons = [
      {
        id: '2-1',
        title: 'Cold Friendly Offer Intro',
        content: 'Introduction to cold friendly offers and how they work for cold traffic.',
        order: 1,
        videoUrl: 'https://youtu.be/D6c545SJcAQ',
      },
      {
        id: '2-2',
        title: 'Cold Friendly Offer Anatomy',
        content: 'Breaking down the structure and components of a cold friendly offer.',
        order: 2,
        videoUrl: 'https://youtu.be/aZxsco_wlvg',
      },
      {
        id: '2-3',
        title: 'Cold Friendly Offer Beispiel Breakdown',
        content: 'Detailed breakdown of example cold friendly offers.',
        order: 3,
        videoUrl: 'https://youtu.be/GPvstbTgBmA',
      },
    ]

    // Use INSERT ... ON CONFLICT to ensure all lessons are present with correct videos
    for (const lesson of course2Lessons) {
      await dbRun(
        `INSERT INTO lessons (id, course_id, title, content, video_url, order_index) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           video_url = EXCLUDED.video_url,
           order_index = EXCLUDED.order_index`,
        [lesson.id, '2', lesson.title, lesson.content, lesson.videoUrl, lesson.order]
      )
    }
    
    console.log('Updated Course 2 structure with 3 lessons')
  } catch (error) {
    console.error('Error updating Course 2 structure:', error)
  }
}

// Update Course 3 structure (Cold Friendly Offer - SOP Library [US])
async function updateCourse3Structure() {
  try {
    const course3Lessons = [
      {
        id: '3-1',
        title: 'Cold Friendly Offer Intro',
        content: 'Introduction to cold friendly offers and how they work for cold traffic.',
        order: 1,
        videoUrl: 'https://youtu.be/0EWNwoq0wj0',
      },
      {
        id: '3-2',
        title: 'Cold Friendly Offer Anatomy',
        content: 'Breaking down the structure and components of a cold friendly offer.',
        order: 2,
        videoUrl: 'https://youtu.be/y-8dYBHZnKk',
      },
      {
        id: '3-3',
        title: 'Cold Friendly Offer Examples & Breakdown',
        content: 'Detailed breakdown of example cold friendly offers.',
        order: 3,
        videoUrl: 'https://youtu.be/eYDEf-4YTYg',
      },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', ['3'])

    for (const lesson of course3Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index) VALUES (?, ?, ?, ?, ?, ?)',
        [lesson.id, '3', lesson.title, lesson.content, lesson.videoUrl, lesson.order]
      )
    }

    console.log('Updated Course 3 structure with 3 lessons')
  } catch (error) {
    console.error('Error updating Course 3 structure:', error)
  }
}

// Update Course 4 structure (Meta Ads - SOP Library)
async function updateCourse4Structure() {
  try {
    const course4Lessons = [
      { id: '4-1', title: 'Intro', content: 'Introduction to Meta Ads and the SOP Library.', order: 1, videoUrl: 'https://youtu.be/ThGabZYSTfo', section: 'Intro' },
      { id: '4-2', title: 'Meta Ads Overview', content: 'Overview of Meta advertising platform and its capabilities.', order: 2, videoUrl: 'https://youtu.be/N5NsOq-pnuY', section: 'Basis' },
      { id: '4-3', title: 'Tracking Set Up', content: 'How to set up tracking for Meta Ads campaigns.', order: 3, videoUrl: 'https://youtu.be/fNfFOiH0lNM', section: 'Basis' },
      { id: '4-4', title: 'Testing Strategie', content: 'Testing strategies for Meta Ads campaigns.', order: 4, videoUrl: 'https://youtu.be/e1lcDSonW60', section: 'Testing & Optimierung' },
      { id: '4-5', title: 'Optimierung', content: 'Optimization techniques for Meta Ads.', order: 5, videoUrl: 'https://youtu.be/CgDh-AlQr5k', section: 'Testing & Optimierung' },
      { id: '4-6', title: 'Attributionsfenster', content: 'Understanding attribution windows for Meta Ads.', order: 6, videoUrl: 'https://youtu.be/FH-6K7Wb3Io', section: 'Testing & Optimierung' },
      { id: '4-7', title: 'Blitzscaling vs Zinseszins Scaling', content: 'Comparing Blitzscaling and Zinseszins scaling strategies.', order: 7, videoUrl: 'https://youtu.be/cEzqxCcSQtc', section: 'Scaling' },
      { id: '4-8', title: 'Zinseszins Scaling', content: 'Compound interest scaling approach for Meta Ads.', order: 8, videoUrl: 'https://youtu.be/7Cc6DTyqbDc', section: 'Scaling' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', ['4'])

    for (const lesson of course4Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, '4', lesson.title, lesson.content, lesson.videoUrl, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 4 structure with 8 lessons')
  } catch (error) {
    console.error('Error updating Course 4 structure:', error)
  }
}

// Update Course 5 structure (Facebook Ads - SOP Library [US])
async function updateCourse5Structure() {
  try {
    const courseId = '5'
    const course5Lessons = [
      { id: '5-1', title: 'Account Structure Overview [US]', content: 'Detailed overview of Facebook Ads account structure specific to the US market.', order: 1, videoUrl: 'https://www.loom.com/share/2c5c6417f8794e6a87997e0c97c50efa', section: 'Account Structure' },
      { id: '5-2', title: 'Creative Format', content: 'Understanding different creative formats for Facebook Ads.', order: 2, videoUrl: 'https://files.skool.com/f/db767458c923401eb32c82398f59ebd0/a46cc04bfb0740e7a19f433b54a1e508401f73cf82754eec906988736a95f6b2?Expires=1769933857&Signature=iXxP3AlQO5PmVybskz93-Q10IyB0w2yrkF4jZvClxb3PFlmsC9eUfB3uuazHeWFpGs~x6VrGGqI~MQehCVg0c5IlavH57Tva34Wdh94CPuqqNJQOvJuA6T8hKB1cKYh2-86Sp77scXEd37Mi4bTcwtXIL62FtW8etuFK2JPvDSnjGMGQOUDHRBsJl1x4xVRYTug1wOJMk1ukKC~DsuwUahLjYk2Q45lmSr2VZCTttLBJXwfBH1G1ExEqVil7jL0AwfycsyVjUHU-nAg2Y7Pf-AKcFcOsfhOVGUzZnzATegWnmEutMw~SE5T-v686JWQhbBnMJhDf8AYogGCoNlUkqg__&Key-Pair-Id=K1UMNJVTUVQ48Y', section: 'Creative Strategy' },
      { id: '5-3', title: 'ClickUp Creative Process', content: 'Detailed workflow for creative production using ClickUp.', order: 3, videoUrl: null, section: 'Creative Strategy' },
      { id: '5-4', title: 'Testing & Optimization', content: 'Strategies for testing and optimizing Facebook Ad campaigns.', order: 4, videoUrl: 'https://www.loom.com/share/df7922356dfd47b5ab37e7d737ccf970', section: 'Testing & Optimization' },
      { id: '5-5', title: 'Retargeting 101', content: 'Introduction to retargeting campaigns on Facebook Ads.', order: 5, videoUrl: 'https://www.loom.com/share/524c54db2d0544cbb0b69b5d570fe2cf', section: 'Advanced Strategies' },
      { id: '5-6', title: 'Scaling Process', content: 'Methods for scaling successful Facebook Ads campaigns.', order: 6, videoUrl: 'https://www.loom.com/share/1062d87a00b946b082b0780dfd57ccd5', section: 'Advanced Strategies' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course5Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 5 structure with 6 lessons and video URLs')
  } catch (error) {
    console.error('Error updating Course 5 structure:', error)
  }
}

// Seed Creative Format Skool URLs as resources for Course 6 (lesson 6-2)
async function seedCourse6CreativeFormatResources() {
  try {
    const adminUser = (await dbGet('SELECT id FROM users WHERE is_admin = true LIMIT 1')) as { id: string } | undefined
    if (!adminUser) return

    const resources = [
      { id: 'course6-creative-format-1', title: 'Creative Format (Part 1)', description: 'Creative format reference for Google Ads.', externalUrl: 'https://files.skool.com/f/db767458c923401eb32c82398f59ebd0/b149b5d67a064891857bbbc1d4aed1b6c48513b75551466bbac60357c882b00c?Expires=1770097778&Signature=jBgidMy-QJz6W3QJP5boe5oC7p3CfoeznKcAIBC5Y07xqdJWwNLTUmk0H2InMUh9Tcifix1SsQVEfqSQWLrvtyufuPbqHFJF2svdxVkZcCe4FhwaWmjlIQWoBY37Nlv43Ov8JC4nHLUfNVO4BdDifr7jI2MGX9n6ebfA66xecp5kM4LHX4GzgYiYXQpIEE2fhUEed1w0EXzE0ZFGqPhcv9jcKLfpzvkpVvl3obFhvteXZ1cGZan1kxt1KqkU66qNZ2TCJcyzOdFJervVKRhHLZzy0oOvHQ5AGmEvu5gLPb1V1Yz9lGtwxsk97kbymAx1TeLfthBnY0NEJo3DJXt2dg__&Key-Pair-Id=K1UMNJVTUVQ48Y' },
      { id: 'course6-creative-format-2', title: 'Creative Format (Part 2)', description: 'Creative format reference for Google Ads.', externalUrl: 'https://files.skool.com/f/db767458c923401eb32c82398f59ebd0/9bc5680c27d14d6ba38a8ddf4fd888652fc32731db3a40d2a7e8f6d9534c5097?Expires=1770097822&Signature=etwlXVIsYTbjw7imO4UxQZeo3rmEVrhEorsKEIHBlgZzphKfkev9k5S12RHm4iCqMa2pNlbACaF9wmjYvDDZ-22ePXfd2irGlnBDqxSLS7b0nnpBJBT64FVcbK2e8Wy0z8cJwrmRIYs6IhZ--hoRde3BTGQBm~I20AuQnEeiufuiQoaLqdofs924r4mKiiUfKe7PQCwP6v6n2rhjHIgakSHz9zM5jdj7kFXe0Ei9VPzNG7D9Ihl3WPNQgGSzGBXGZ7GxV-z9eiUupk8prjof-1fAJTnAY3cQQrZLkRa6n3Ih5jpRZZFgj9RpcmK6qzcNhilzRT9TfSGL7G3XWt7aFg__&Key-Pair-Id=K1UMNJVTUVQ48Y' },
    ]

    for (const r of resources) {
      await dbRun(
        `INSERT OR REPLACE INTO resources (id, course_id, lesson_id, title, description, resource_type, file_url, file_name, external_url, uploaded_by)
         VALUES (?, ?, ?, ?, ?, 'url', NULL, NULL, ?, ?)`,
        [r.id, '6', '6-2', r.title, r.description, r.externalUrl, adminUser.id]
      )
    }
    console.log('Seeded Course 6 Creative Format resources')
  } catch (error) {
    console.error('Error seeding Course 6 Creative Format resources:', error)
  }
}

// Update Course 6 structure (03: Google Ads - SOP Library)
async function updateCourse6Structure() {
  try {
    const courseId = '6'
    const course6Lessons = [
      { id: '6-1', title: 'Google Ads Roadmap', content: 'Overview of the Google Ads learning path and roadmap.', order: 1, videoUrl: 'https://www.loom.com/share/d95f3dfebea24c429659d384b0ca7034', section: 'Intro' },
      { id: '6-2', title: 'Creative Format', content: 'Understanding creative formats for Google Ads campaigns.', order: 2, videoUrl: null, section: 'Intro' },
      { id: '6-3', title: 'Ad Account Set Up', content: 'Setting up your Google Ads account.', order: 3, videoUrl: 'https://www.loom.com/share/9f6a2b0f1e744dbc95a1c96ec26aeb29', section: 'Account + Tracking Set Up' },
      { id: '6-4', title: 'Merchant Center Set Up', content: 'Configuring Google Merchant Center for Shopping campaigns.', order: 4, videoUrl: 'https://www.loom.com/share/7897e0b408494b0a8c276a1a0666842a', section: 'Account + Tracking Set Up' },
      { id: '6-5', title: 'Tracking + Feed Set Up', content: 'Setting up tracking and product feeds.', order: 5, videoUrl: 'https://www.loom.com/share/8f3d434f136b47dd87b8d63cf9cf40a0', section: 'Account + Tracking Set Up' },
      { id: '6-6', title: 'ADDITION: Enhanced Conversions', content: 'Enhanced conversions setup and best practices.', order: 6, videoUrl: 'https://www.loom.com/share/8138bf192ebb4f4a9260363a4cbef011', section: 'Account + Tracking Set Up' },
      { id: '6-7', title: 'Column Set Up', content: 'Configuring columns and reporting in Google Ads.', order: 7, videoUrl: 'https://www.loom.com/share/754d3295449e4abb9dd15689aebf66c2', section: 'Column Set Up' },
      { id: '6-8', title: 'Competitor Search Campaign', content: 'Setting up and optimizing competitor search campaigns.', order: 8, videoUrl: 'https://www.loom.com/share/32cd49342a1548bb852024d4cdf1cf7f', section: 'Search Ads' },
      { id: '6-9', title: 'Brand Search Campaign', content: 'Brand search campaign strategies and setup.', order: 9, videoUrl: 'https://www.loom.com/share/f42f50a788204add821b4e4614e0ad37', section: 'Search Ads' },
      { id: '6-10', title: 'Cold Search Roadmap', content: 'Roadmap for cold search campaign development.', order: 10, videoUrl: 'https://www.loom.com/share/f1463c99d9584000970859e6d186295f', section: 'Search Ads' },
      { id: '6-11', title: 'Keyword Research', content: 'Conducting keyword research for Google Ads.', order: 11, videoUrl: 'https://www.loom.com/share/3557ec9ca12542b6afa32f37e7d58806', section: 'Search Ads' },
      { id: '6-12', title: 'Google Ads Copy', content: 'Writing effective ad copy for Google Ads.', order: 12, videoUrl: 'https://www.loom.com/share/cd869913b362437ab0cfa5bcbdadd350', section: 'Search Ads' },
      { id: '6-13', title: 'Google Ad Extensions', content: 'Using ad extensions to improve performance.', order: 13, videoUrl: 'https://www.loom.com/share/dc586821841943ecb3ac67a90564059e', section: 'Search Ads' },
      { id: '6-14', title: 'Cold Search Set Up', content: 'Setting up cold search campaigns.', order: 14, videoUrl: 'https://www.loom.com/share/255148dcdc344d22ba1a5574c4955a78', section: 'Search Ads' },
      { id: '6-15', title: 'Negativ Keywords', content: 'Managing negative keywords for better targeting.', order: 15, videoUrl: 'https://www.loom.com/share/f182b12d76f14d128fc6f4ab142d75e2', section: 'Search Ads' },
      { id: '6-16', title: 'Dynamic Search Ads Intro', content: 'Introduction to Dynamic Search Ads.', order: 16, videoUrl: 'https://www.loom.com/share/aead635572dc4383aba110bef9d0bbfe', section: 'Search Ads' },
      { id: '6-17', title: 'Shopping Roadmap', content: 'Roadmap for Google Shopping campaigns.', order: 17, videoUrl: 'https://www.loom.com/share/afd86e01cc944582b11ef40826b66083', section: 'Google Shopping' },
      { id: '6-18', title: 'Feed Optimization', content: 'Optimizing product feeds for Shopping campaigns.', order: 18, videoUrl: 'https://www.loom.com/share/e9659d6c98b0423b986254cdb44d4181', section: 'Google Shopping' },
      { id: '6-19', title: 'Shopping Strategies', content: 'Strategies for successful Shopping campaigns.', order: 19, videoUrl: 'https://www.loom.com/share/2dc72a2e32ea4776956f6763fc00f87e', section: 'Google Shopping' },
      { id: '6-20', title: 'Creating a Shopping Campaign', content: 'Step-by-step guide to creating Shopping campaigns.', order: 20, videoUrl: 'https://www.loom.com/share/7f5550b746474a0aa52e5fe15ee30adc', section: 'Google Shopping' },
      { id: '6-21', title: 'Getting Ready to Scale', content: 'Preparing your campaigns for scaling.', order: 21, videoUrl: 'https://www.loom.com/share/234acc85282a45239a60dabb0e50cc3c', section: 'Google Shopping' },
      { id: '6-22', title: 'Optimizing & Scaling', content: 'Optimization and scaling strategies for Shopping.', order: 22, videoUrl: 'https://www.loom.com/share/96fc73e1f69b4e2bbf734ab35669fd0f', section: 'Google Shopping' },
      { id: '6-23', title: 'Display Retargeting', content: 'Display retargeting campaign setup and optimization.', order: 23, videoUrl: 'https://www.loom.com/share/a9fe7dbffbd9445a8c19868a1f02d622', section: 'Display + Discovery Retargeting' },
      { id: '6-24', title: 'Discovery Retargeting', content: 'Discovery campaign retargeting strategies.', order: 24, videoUrl: 'https://www.loom.com/share/a1a6a1d8d3d947c3b8be2d4327dae0e2', section: 'Display + Discovery Retargeting' },
      { id: '6-25', title: 'PMAX Overview + Structures', content: 'Performance Max campaigns overview and structure.', order: 25, videoUrl: 'https://www.loom.com/share/77d990992eaa4b67ae2e94dc7aa37ec8', section: 'Performance Max' },
      { id: '6-26', title: 'PMAX Set Up', content: 'Setting up Performance Max campaigns.', order: 26, videoUrl: 'https://www.loom.com/share/d8651d38a89243369c38c8bc372f6d46', section: 'Performance Max' },
      { id: '6-28', title: 'Optimization and Scaling', content: 'Optimizing and scaling Performance Max campaigns.', order: 27, videoUrl: 'https://www.loom.com/share/24a1c8f3b64a448e951fbc98a17ece43', section: 'Performance Max' },
      { id: '6-27', title: 'Optimization Routine', content: 'Establishing an optimization routine for Google Ads.', order: 28, videoUrl: 'https://www.loom.com/share/959dd5df5f5541f888714e4a192e9150', section: 'Prozess' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course6Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    await seedCourse6CreativeFormatResources()
    console.log('Updated Course 6 structure with 28 lessons, 8 sections, and video URLs')
  } catch (error) {
    console.error('Error updating Course 6 structure:', error)
  }
}

// Update Course 7 structure (03: Google Ads - SOP Library [US])
async function updateCourse7Structure() {
  try {
    const courseId = '7'
    const course7Lessons = [
      { id: '7-1', title: 'Google Ads Roadmap', content: 'Overview of the Google Ads learning path and roadmap for US market.', order: 1, videoUrl: 'https://www.loom.com/share/d95f3dfebea24c429659d384b0ca7034', section: null },
      { id: '7-2', title: 'Ad Account Set Up', content: 'Setting up your Google Ads account for the US market.', order: 2, videoUrl: 'https://www.loom.com/share/9f6a2b0f1e744dbc95a1c96ec26aeb29', section: 'Tech Set Up' },
      { id: '7-3', title: 'Merchant Center Set Up', content: 'Configuring Google Merchant Center for Shopping campaigns.', order: 3, videoUrl: 'https://www.loom.com/share/7897e0b408494b0a8c276a1a0666842a', section: 'Tech Set Up' },
      { id: '7-4', title: 'Tracking + Feed Set Up', content: 'Setting up tracking and product feeds.', order: 4, videoUrl: 'https://www.loom.com/share/8f3d434f136b47dd87b8d63cf9cf40a0', section: 'Tech Set Up' },
      { id: '7-5', title: 'ADDITION: Enhanced Conversions', content: 'Enhanced conversions setup and best practices.', order: 5, videoUrl: 'https://www.loom.com/share/8138bf192ebb4f4a9260363a4cbef011', section: 'Tech Set Up' },
      { id: '7-6', title: 'Creative Format', content: 'Understanding creative formats for Google Ads campaigns.', order: 6, videoUrl: null, section: 'Tech Set Up' },
      { id: '7-7', title: 'Brand Search Campaign', content: 'Brand search campaign strategies and setup.', order: 7, videoUrl: 'https://www.loom.com/share/f42f50a788204add821b4e4614e0ad37', section: 'Search Ads' },
      { id: '7-8', title: 'Competitor Search', content: 'Setting up and optimizing competitor search campaigns.', order: 8, videoUrl: 'https://www.loom.com/share/32cd49342a1548bb852024d4cdf1cf7f', section: 'Search Ads' },
      { id: '7-9', title: 'Cold Search Overview', content: 'Roadmap for cold search campaign development.', order: 9, videoUrl: 'https://www.loom.com/share/f1463c99d9584000970859e6d186295f', section: 'Search Ads' },
      { id: '7-10', title: 'Keyword Research', content: 'Conducting keyword research for Google Ads.', order: 10, videoUrl: 'https://www.loom.com/share/3557ec9ca12542b6afa32f37e7d58806', section: 'Search Ads' },
      { id: '7-11', title: 'Ad Copy', content: 'Writing effective ad copy for Google Ads.', order: 11, videoUrl: 'https://www.loom.com/share/cd869913b362437ab0cfa5bcbdadd350', section: 'Search Ads' },
      { id: '7-12', title: 'Ad Extensions', content: 'Using ad extensions to improve performance.', order: 12, videoUrl: 'https://www.loom.com/share/dc586821841943ecb3ac67a90564059e', section: 'Search Ads' },
      { id: '7-13', title: 'Cold Search Set Up', content: 'Setting up cold search campaigns.', order: 13, videoUrl: 'https://www.loom.com/share/255148dcdc344d22ba1a5574c4955a78', section: 'Search Ads' },
      { id: '7-14', title: 'Negativ Keywords', content: 'Managing negative keywords for better targeting.', order: 14, videoUrl: 'https://www.loom.com/share/f182b12d76f14d128fc6f4ab142d75e2', section: 'Search Ads' },
      { id: '7-15', title: 'Dynamic Search Ads', content: 'Introduction to Dynamic Search Ads.', order: 15, videoUrl: 'https://www.loom.com/share/aead635572dc4383aba110bef9d0bbfe', section: 'Search Ads' },
      { id: '7-16', title: 'Shopping Overview', content: 'Roadmap for Google Shopping campaigns.', order: 16, videoUrl: 'https://www.loom.com/share/afd86e01cc944582b11ef40826b66083', section: 'Shopping' },
      { id: '7-17', title: 'Feed Optimization', content: 'Optimizing product feeds for Shopping campaigns.', order: 17, videoUrl: 'https://www.loom.com/share/e9659d6c98b0423b986254cdb44d4181', section: 'Shopping' },
      { id: '7-18', title: 'Shopping Strategies', content: 'Strategies for successful Shopping campaigns.', order: 18, videoUrl: 'https://www.loom.com/share/2dc72a2e32ea4776956f6763fc00f87e', section: 'Shopping' },
      { id: '7-19', title: 'Getting Ready to Scale', content: 'Preparing your campaigns for scaling.', order: 19, videoUrl: 'https://www.loom.com/share/234acc85282a45239a60dabb0e50cc3c', section: 'Shopping' },
      { id: '7-20', title: 'Display Retargeting', content: 'Display retargeting campaign setup and optimization.', order: 20, videoUrl: 'https://www.loom.com/share/a9fe7dbffbd9445a8c19868a1f02d622', section: 'Display + Discovery' },
      { id: '7-21', title: 'Discovery Retargeting', content: 'Discovery campaign retargeting strategies.', order: 21, videoUrl: 'https://www.loom.com/share/a1a6a1d8d3d947c3b8be2d4327dae0e2', section: 'Display + Discovery' },
      { id: '7-22', title: 'PMAX Overview', content: 'Performance Max campaigns overview and structure.', order: 22, videoUrl: 'https://www.loom.com/share/77d990992eaa4b67ae2e94dc7aa37ec8', section: 'PMAX' },
      { id: '7-23', title: 'PMAX Set Up', content: 'Setting up Performance Max campaigns.', order: 23, videoUrl: 'https://www.loom.com/share/d8651d38a89243369c38c8bc372f6d46', section: 'PMAX' },
      { id: '7-24', title: 'PMAX Optimizing & Scaling', content: 'Optimizing and scaling Performance Max campaigns.', order: 24, videoUrl: 'https://www.loom.com/share/24a1c8f3b64a448e951fbc98a17ece43', section: 'PMAX' },
      { id: '7-25', title: 'Optimization Routine', content: 'Establishing an optimization routine for Google Ads.', order: 25, videoUrl: 'https://www.loom.com/share/959dd5df5f5541f888714e4a192e9150', section: 'Prozess' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course7Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    await seedCourse7CreativeFormatResources()
    console.log('Updated Course 7 structure (03: Google Ads - SOP Library [US]) with 25 lessons and 6 sections')
  } catch (error) {
    console.error('Error updating Course 7 structure:', error)
  }
}

// Seed Creative Format Skool URLs as resources for Course 7 (lesson 7-6)
async function seedCourse7CreativeFormatResources() {
  try {
    const adminUser = (await dbGet('SELECT id FROM users WHERE is_admin = true LIMIT 1')) as { id: string } | undefined
    if (!adminUser) return

    const resources = [
      { id: 'course7-creative-format-1', title: 'Creative Format (Part 1)', description: 'Creative format reference for Google Ads.', externalUrl: 'https://files.skool.com/f/db767458c923401eb32c82398f59ebd0/b149b5d67a064891857bbbc1d4aed1b6c48513b75551466bbac60357c882b00c?Expires=1770097778&Signature=jBgidMy-QJz6W3QJP5boe5oC7p3CfoeznKcAIBC5Y07xqdJWwNLTUmk0H2InMUh9Tcifix1SsQVEfqSQWLrvtyufuPbqHFJF2svdxVkZcCe4FhwaWmjlIQWoBY37Nlv43Ov8JC4nHLUfNVO4BdDifr7jI2MGX9n6ebfA66xecp5kM4LHX4GzgYiYXQpIEE2fhUEed1w0EXzE0ZFGqPhcv9jcKLfpzvkpVvl3obFhvteXZ1cGZan1kxt1KqkU66qNZ2TCJcyzOdFJervVKRhHLZzy0oOvHQ5AGmEvu5gLPb1V1Yz9lGtwxsk97kbymAx1TeLfthBnY0NEJo3DJXt2dg__&Key-Pair-Id=K1UMNJVTUVQ48Y' },
      { id: 'course7-creative-format-2', title: 'Creative Format (Part 2)', description: 'Creative format reference for Google Ads.', externalUrl: 'https://files.skool.com/f/db767458c923401eb32c82398f59ebd0/9bc5680c27d14d6ba38a8ddf4fd888652fc32731db3a40d2a7e8f6d9534c5097?Expires=1770097822&Signature=etwlXVIsYTbjw7imO4UxQZeo3rmEVrhEorsKEIHBlgZzphKfkev9k5S12RHm4iCqMa2pNlbACaF9wmjYvDDZ-22ePXfd2irGlnBDqxSLS7b0nnpBJBT64FVcbK2e8Wy0z8cJwrmRIYs6IhZ--hoRde3BTGQBm~I20AuQnEeiufuiQoaLqdofs924r4mKiiUfKe7PQCwP6v6n2rhjHIgakSHz9zM5jdj7kFXe0Ei9VPzNG7D9Ihl3WPNQgGSzGBXGZ7GxV-z9eiUupk8prjof-1fAJTnAY3cQQrZLkRa6n3Ih5jpRZZFgj9RpcmK6qzcNhilzRT9TfSGL7G3XWt7aFg__&Key-Pair-Id=K1UMNJVTUVQ48Y' },
    ]

    for (const r of resources) {
      await dbRun(
        `INSERT OR REPLACE INTO resources (id, course_id, lesson_id, title, description, resource_type, file_url, file_name, external_url, uploaded_by)
         VALUES (?, ?, ?, ?, ?, 'url', NULL, NULL, ?, ?)`,
        [r.id, '7', '7-6', r.title, r.description, r.externalUrl, adminUser.id]
      )
    }
    console.log('Seeded Course 7 Creative Format resources')
  } catch (error) {
    console.error('Error seeding Course 7 Creative Format resources:', error)
  }
}

// Seed Creative Format Skool URL as resource for Course 8 (lesson 8-8)
async function seedCourse8CreativeFormatResources() {
  try {
    const adminUser = (await dbGet('SELECT id FROM users WHERE is_admin = true LIMIT 1')) as { id: string } | undefined
    if (!adminUser) return

    const resources = [
      { id: 'course8-creative-format-1', title: 'Creative Format', description: 'Creative format reference for TikTok Ads.', externalUrl: 'https://files.skool.com/f/db767458c923401eb32c82398f59ebd0/f1a50050357c452c86f5f9ace596a1b50700b98d854f47eb85a68fffa437bf7d?Expires=1770535617&Signature=XnjYvcUlPS4GCFk7yf8L~FqT7WpVz4EadJMy4gUGsnUeiKN0rVsTNR2l8oRt~2txyns~1lFUthKhebX7rAMaIlnTfAPwocHSf6FXAzw5Wfje4gfSDi5GzKi-OGovsuvrfItv57v914S31YZ1jHmI2cl9ZLvrA7zIFlBeBCd8nqEUiZdni-QT9NCKPnipB7elFQ~gNA2UOpi~gmVimGojKD0s1E4JpMk6tmij6Nnbm8Db-BSWZedL80QUOAVGsZPHAfTDYMpNKxGSfyP~9K0tdK9-9fKd46snqJ8g69Kw23M9pfnouUqTmMgDSEk5KC4OH~zsoq1C8CWauOoFWClGFQ__&Key-Pair-Id=K1UMNJVTUVQ48Y' },
    ]

    for (const r of resources) {
      await dbRun(
        `INSERT OR REPLACE INTO resources (id, course_id, lesson_id, title, description, resource_type, file_url, file_name, external_url, uploaded_by)
         VALUES (?, ?, ?, ?, ?, 'url', NULL, NULL, ?, ?)`,
        [r.id, '8', '8-8', r.title, r.description, r.externalUrl, adminUser.id]
      )
    }
    console.log('Seeded Course 8 Creative Format resources')
  } catch (error) {
    console.error('Error seeding Course 8 Creative Format resources:', error)
  }
}

// Update Course 8 structure (04: TikTok Ads - SOP Library)
async function updateCourse8Structure() {
  try {
    const courseId = '8'
    const course8Lessons = [
      { id: '8-1', title: 'Intro & Tech Set Up', content: 'Introduction and technical setup for TikTok Ads.', order: 1, videoUrl: 'https://www.loom.com/share/38490c197582469c99d31f41bfb577c9', section: 'Intro' },
      { id: '8-2', title: 'TikTok Ads Roadmap', content: 'Overview of the TikTok Ads learning path and roadmap.', order: 2, videoUrl: 'https://www.loom.com/share/d693c0f3cc0e4415864832a5d899140b', section: 'Intro' },
      { id: '8-3', title: 'Roadmap Overview', content: 'Media buying roadmap overview for TikTok Ads.', order: 3, videoUrl: 'https://www.loom.com/share/af8c933d18e645f5a711948fc0d85aa6', section: 'Media Buying' },
      { id: '8-4', title: 'Campaign Set up', content: 'Setting up TikTok Ads campaigns.', order: 4, videoUrl: 'https://www.loom.com/share/c5a6d12c16fc4a6e84622278982a51b3', section: 'Media Buying' },
      { id: '8-5', title: 'Optimization & Scaling', content: 'Optimizing and scaling TikTok Ads campaigns.', order: 5, videoUrl: 'https://www.loom.com/share/53d5750e759848fc85b5b039ff3329d4', section: 'Media Buying' },
      { id: '8-6', title: 'Creative Production Best Practices', content: 'Best practices for TikTok creative production.', order: 6, videoUrl: 'https://www.loom.com/share/d9bbef849ce4469099c2a98e6c3cb72e', section: 'Creative' },
      { id: '8-7', title: 'Creative Anatomy', content: 'Understanding the anatomy of effective TikTok creatives.', order: 7, videoUrl: 'https://www.loom.com/share/00f78c9c3fd44d52a6989df3f6b83093', section: 'Creative' },
      { id: '8-8', title: 'Creative Format', content: 'Creative formats for TikTok Ads campaigns.', order: 8, videoUrl: null, section: 'Creative' },
      { id: '8-9', title: 'Konzepte & Hooks', content: 'Concepts and hooks for engaging TikTok creatives.', order: 9, videoUrl: 'https://www.loom.com/share/deeb2068731f4151a591c13c7b852dd4', section: 'Creative' },
      { id: '8-10', title: 'Creative Analyse', content: 'Analyzing TikTok creative performance.', order: 10, videoUrl: 'https://www.loom.com/share/e420aaa277b646ada7100ed725a9c729', section: 'Creative' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course8Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    await seedCourse8CreativeFormatResources()
    console.log('Updated Course 8 structure (04: TikTok Ads - SOP Library) with 10 lessons and 3 sections')
  } catch (error) {
    console.error('Error updating Course 8 structure:', error)
  }
}

// Update Course 9 structure (05 - 8 Figure Creative Frameworks & ...)
async function updateCourse9Structure() {
  try {
    const courseId = '9'
    const course9Lessons = [
      { id: '9-1', title: 'Importance, Benchmarks, Lingo', content: 'Introduction to importance, benchmarks and terminology.', order: 1, videoUrl: null, section: '0 - Intro' },
      { id: '9-2', title: 'Execution Options', content: 'Different execution options for creative frameworks.', order: 2, videoUrl: null, section: '0 - Intro' },
      { id: '9-3', title: 'Basic Competitor Research', content: 'How to conduct basic competitor research.', order: 3, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '9-4', title: 'Creative Fast Track Intro', content: 'Introduction to the Creative Fast Track methodology.', order: 4, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '9-5', title: 'Post Purchase Survey', content: 'Using post-purchase surveys for creative insights.', order: 5, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '9-6', title: 'Creative Frameworks Level 1', content: 'Foundational creative frameworks.', order: 6, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '9-7', title: 'Creative Scripting & Content Sourcing', content: 'Scripting and sourcing content for creatives.', order: 7, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '9-8', title: 'Marketing Fundamentals Intro', content: 'Introduction to marketing fundamentals.', order: 8, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '9-9', title: 'Marketing Fundamentals Crash Course', content: 'Crash course on essential marketing fundamentals.', order: 9, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '9-10', title: 'Market Awareness Stages', content: 'Understanding market awareness stages.', order: 10, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '9-11', title: 'Market Sophistication', content: 'Market sophistication and its impact on creative strategy.', order: 11, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '9-12', title: 'Creative Frameworks Level 2', content: 'Advanced creative frameworks.', order: 12, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '9-13', title: 'D2C Spy List', content: 'D2C spy list for competitive intelligence.', order: 13, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '9-14', title: 'Ad Positioning Blocks', content: 'Building blocks for ad positioning.', order: 14, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '9-15', title: 'Creative Roadmap Overview', content: 'Overview of the creative roadmap process.', order: 15, videoUrl: null, section: '3 - Building the Base' },
      { id: '9-16', title: 'Market Research', content: 'Conducting effective market research.', order: 16, videoUrl: null, section: '3 - Building the Base' },
      { id: '9-17', title: 'AI: Creative Roadmap Fill Out', content: 'Using AI to fill out the creative roadmap.', order: 17, videoUrl: null, section: '3 - Building the Base' },
      { id: '9-18', title: '7 Figure Ad Writing Process', content: 'The 7-figure ad writing process.', order: 18, videoUrl: null, section: '4 - Writing your Ad' },
      { id: '9-19', title: 'AI: 7 Figure Ad Writing Process', content: 'AI-assisted 7-figure ad writing process.', order: 19, videoUrl: null, section: '4 - Writing your Ad' },
      { id: '9-20', title: 'Fehler bei 90% der Brands', content: 'Common mistakes made by 90% of brands.', order: 20, videoUrl: null, section: '5 - Creative Production' },
      { id: '9-21', title: 'Selling Power durch DR, B-Roll & Editing', content: 'Selling power through direct response, B-roll and editing.', order: 21, videoUrl: null, section: '5 - Creative Production' },
      { id: '9-22', title: 'High Impact Testing', content: 'High impact testing strategies for creatives.', order: 22, videoUrl: null, section: '5 - Creative Production' },
      { id: '9-23', title: 'Schnelle & Kapitaleffiziente Creative Produktion', content: 'Fast and capital-efficient creative production.', order: 23, videoUrl: null, section: '5 - Creative Production' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course9Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 9 structure (05 - 8 Figure Creative Frameworks & ...) with 23 lessons and 6 sections')
  } catch (error) {
    console.error('Error updating Course 9 structure:', error)
  }
}

// Update Course 10 structure (05 - 8 Figure Creative Frameworks & Processes [US])
async function updateCourse10Structure() {
  try {
    const courseId = '10'
    const course10Lessons = [
      // Intro
      { id: '10-1', title: 'Importance, Benchmarks, Lingo', content: 'Introduction to importance, benchmarks and terminology for US market.', order: 1, videoUrl: null, section: 'Intro' },
      { id: '10-2', title: 'Execution Options', content: 'Different execution options for creative frameworks in the US.', order: 2, videoUrl: null, section: 'Intro' },
      // 1 - Creative Fast Track
      { id: '10-3', title: 'Creative Fast Track Intro', content: 'Introduction to the Creative Fast Track methodology for US.', order: 3, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '10-4', title: 'Competitor Research Process', content: 'Competitor research process for creative development.', order: 4, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '10-5', title: 'Post Purchase Survey', content: 'Using post-purchase surveys for creative insights.', order: 5, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '10-6', title: 'Creative Frameworks Level 1', content: 'Foundational creative frameworks for US market.', order: 6, videoUrl: null, section: '1 - Creative Fast Track' },
      { id: '10-7', title: 'Scripting & Content Sourcing', content: 'Scripting and sourcing content for creatives.', order: 7, videoUrl: null, section: '1 - Creative Fast Track' },
      // 2 - Marketing Fundamentals
      { id: '10-8', title: 'Marketing Fundamentals Intro', content: 'Introduction to marketing fundamentals for US.', order: 8, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '10-9', title: 'Marketing Fundamentals Crash Course', content: 'Crash course on essential marketing fundamentals.', order: 9, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '10-10', title: 'Market Awareness', content: 'Understanding market awareness in the US.', order: 10, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '10-11', title: 'Market Sophistication', content: 'Market sophistication and its impact on creative strategy.', order: 11, videoUrl: null, section: '2 - Marketing Fundamentals' },
      { id: '10-12', title: 'Ad Frameworks', content: 'Ad frameworks for US market.', order: 12, videoUrl: null, section: '2 - Marketing Fundamentals' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course10Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 10 structure (05 - 8 Figure Creative Frameworks & Processes [US]) with 12 lessons and 3 sections')
  } catch (error) {
    console.error('Error updating Course 10 structure:', error)
  }
}

// Update Course 11 structure (06 - Direct Response)
async function updateCourse11Structure() {
  try {
    const courseId = '11'
    const course11Lessons = [
      // 1 - Hier starten
      { id: '11-1', title: 'Übersicht', content: 'Overview of the Direct Response course.', order: 1, videoUrl: null, section: '1 - Hier starten' },
      { id: '11-2', title: 'Post Purchase Survey', content: 'Post purchase survey for direct response.', order: 2, videoUrl: null, section: '1 - Hier starten' },
      // 2 - Knowledge Ramp
      { id: '11-3', title: 'Marketing Fundamentals Crash Course', content: 'Crash course on marketing fundamentals.', order: 3, videoUrl: null, section: '2 - Knowledge Ramp' },
      { id: '11-4', title: 'Market Awareness', content: 'Understanding market awareness.', order: 4, videoUrl: null, section: '2 - Knowledge Ramp' },
      { id: '11-5', title: 'Market Sophistication', content: 'Market sophistication for direct response.', order: 5, videoUrl: null, section: '2 - Knowledge Ramp' },
      { id: '11-6', title: 'Diamond Files', content: 'Diamond files for creative development.', order: 6, videoUrl: null, section: '2 - Knowledge Ramp' },
      { id: '11-7', title: 'Unique Mechanism', content: 'Unique mechanism for direct response offers.', order: 7, videoUrl: null, section: '2 - Knowledge Ramp' },
      // 3 - A-Z Direct Response Prozess & ...
      { id: '11-8', title: 'Research Prozess Teil 1', content: 'Research process part 1.', order: 8, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-9', title: 'Research Prozess Teil 2', content: 'Research process part 2.', order: 9, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-10', title: 'Post Purchase Survey Analyse', content: 'Analyzing post purchase survey results.', order: 10, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-11', title: 'Research Prozess Beispiel', content: 'Research process example.', order: 11, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-12', title: 'Brief Beispiel', content: 'Brief example for creative development.', order: 12, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-13', title: 'Unique Mechanism Beispiel', content: 'Unique mechanism example.', order: 13, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-14', title: 'Ad Writing Example & Breakdown', content: 'Ad writing example and breakdown.', order: 14, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-15', title: 'Ad Swiping & Rewriting Prozess', content: 'Ad swiping and rewriting process.', order: 15, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-16', title: 'Selling Power durch B-Roll and Editing', content: 'Selling power through B-roll and editing.', order: 16, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      { id: '11-17', title: '8 Figure VSL Script Swipes', content: '8 Figure VSL script swipes.', order: 17, videoUrl: null, section: '3 - A-Z Direct Response Prozess & ...' },
      // 4 - Prozesse & Produktion
      { id: '11-18', title: 'Briefing & Content Sourcing', content: 'Briefing and content sourcing process.', order: 18, videoUrl: null, section: '4 - Prozesse & Produktion' },
      { id: '11-19', title: 'Schnelle & Kapitaleffiziente Creative Produktion', content: 'Fast and capital-efficient creative production.', order: 19, videoUrl: null, section: '4 - Prozesse & Produktion' },
      { id: '11-20', title: 'Click Up Prozess Templates', content: 'ClickUp process templates.', order: 20, videoUrl: null, section: '4 - Prozesse & Produktion' },
      // 5 - Training
      { id: '11-21', title: 'Advertorial Ads', content: 'Advertorial ads training.', order: 21, videoUrl: null, section: '5 - Training' },
      { id: '11-22', title: '90 Tage Copy Training', content: '90-day copy training.', order: 22, videoUrl: null, section: '5 - Training' },
      { id: '11-23', title: 'High Impact Testing', content: 'High impact testing strategies.', order: 23, videoUrl: null, section: '5 - Training' },
      { id: '11-24', title: 'Fehler bei 90% der Brands', content: 'Common mistakes made by 90% of brands.', order: 24, videoUrl: null, section: '5 - Training' },
      // 6 - Funnel
      { id: '11-25', title: 'Hier starten', content: 'Getting started with funnel.', order: 25, videoUrl: null, section: '6 - Funnel' },
      { id: '11-26', title: 'Funnel Overview', content: 'Overview of the funnel structure.', order: 26, videoUrl: null, section: '6 - Funnel' },
      { id: '11-27', title: 'Front End Funnel', content: 'Front end funnel setup.', order: 27, videoUrl: null, section: '6 - Funnel' },
      { id: '11-28', title: 'Advertorial Breakdown', content: 'Advertorial breakdown and optimization.', order: 28, videoUrl: null, section: '6 - Funnel' },
      { id: '11-29', title: 'Listicle Breakdown', content: 'Listicle breakdown and best practices.', order: 29, videoUrl: null, section: '6 - Funnel' },
      { id: '11-30', title: 'Offer Page Breakdown', content: 'Offer page breakdown and optimization.', order: 30, videoUrl: null, section: '6 - Funnel' },
      { id: '11-31', title: 'Front End CRO Crash Course', content: 'Front end CRO crash course.', order: 31, videoUrl: null, section: '6 - Funnel' },
      { id: '11-32', title: 'Upsells', content: 'Upsell strategies and implementation.', order: 32, videoUrl: null, section: '6 - Funnel' },
      { id: '11-33', title: 'Shopify to Checkout Champ/Funnelish', content: 'Shopify to Checkout Champ/Funnelish integration.', order: 33, videoUrl: null, section: '6 - Funnel' },
      { id: '11-34', title: 'Funnel Swipes', content: 'Funnel swipes for inspiration.', order: 34, videoUrl: null, section: '6 - Funnel' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course11Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 11 structure (06 - Direct Response) with 34 lessons and 6 sections')
  } catch (error) {
    console.error('Error updating Course 11 structure:', error)
  }
}

// Update Course 12 structure (07: Brand Strategy - SOP Library)
async function updateCourse12Structure() {
  try {
    const courseId = '12'
    const course12Lessons = [
      // Planning & Overview
      { id: '12-1', title: 'Intro', content: 'Introduction to Brand Strategy.', order: 1, videoUrl: null, section: 'Planning & Overview' },
      { id: '12-2', title: 'Was ist Brand Strategy?', content: 'What is Brand Strategy?', order: 2, videoUrl: null, section: 'Planning & Overview' },
      { id: '12-3', title: 'Best Practices', content: 'Best practices for brand strategy.', order: 3, videoUrl: null, section: 'Planning & Overview' },
      { id: '12-4', title: 'Planning', content: 'Planning your brand strategy.', order: 4, videoUrl: null, section: 'Planning & Overview' },
      { id: '12-5', title: 'RESSOURCES: Roadmap + Planning Sheet', content: 'Resources: Roadmap and Planning Sheet.', order: 5, videoUrl: null, section: 'Planning & Overview' },
      // Profitabilitätstage
      { id: '12-6', title: 'Intro (WICHTIG: Watch First)', content: 'Intro - important: watch first.', order: 6, videoUrl: null, section: 'Profitabilitätstage' },
      { id: '12-7', title: 'Product Launch Strategie', content: 'Product launch strategy.', order: 7, videoUrl: null, section: 'Profitabilitätstage' },
      { id: '12-8', title: 'VIP Sale', content: 'VIP Sale strategy.', order: 8, videoUrl: null, section: 'Profitabilitätstage' },
      { id: '12-9', title: 'Facebook Ads: Leadform Ads Set Up', content: 'Setting up Facebook Leadform Ads.', order: 9, videoUrl: null, section: 'Profitabilitätstage' },
      { id: '12-10', title: 'Facebook Ads: Landing Page Leads Set Up', content: 'Setting up Facebook Landing Page Leads.', order: 10, videoUrl: null, section: 'Profitabilitätstage' },
      { id: '12-11', title: 'ADDITION: Facebook Ads: Bidcap Campaign', content: 'Additional: Facebook Ads Bidcap Campaign.', order: 11, videoUrl: null, section: 'Profitabilitätstage' },
      { id: '12-12', title: 'ADDITION: SMS + Whatsapp Marketing', content: 'Additional: SMS and Whatsapp Marketing.', order: 12, videoUrl: null, section: 'Profitabilitätstage' },
      // Sonstiges
      { id: '12-13', title: 'Winning Product Revivals', content: 'Winning product revivals strategy.', order: 13, videoUrl: null, section: 'Sonstiges' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course12Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 12 structure (07: Brand Strategy - SOP Library) with 13 lessons and 3 sections')
  } catch (error) {
    console.error('Error updating Course 12 structure:', error)
  }
}

// Update Course 13 structure (08: Email Marketing - SOP Library)
async function updateCourse13Structure() {
  try {
    const courseId = '13'
    const course13Lessons = [
      // Acquisition Flows
      { id: '13-1', title: 'Welcome Flow', content: 'Welcome flow for new subscribers.', order: 1, videoUrl: null, section: 'Acquisition Flows' },
      { id: '13-2', title: 'Abandon Checkout Flow', content: 'Abandon checkout email flow.', order: 2, videoUrl: null, section: 'Acquisition Flows' },
      { id: '13-3', title: 'Abandon Cart Flow', content: 'Abandon cart email flow.', order: 3, videoUrl: null, section: 'Acquisition Flows' },
      { id: '13-4', title: 'Abandon Product Flow', content: 'Abandon product email flow.', order: 4, videoUrl: null, section: 'Acquisition Flows' },
      { id: '13-5', title: 'Abandon Site Flow', content: 'Abandon site email flow.', order: 5, videoUrl: null, section: 'Acquisition Flows' },
      // Retention Flows
      { id: '13-6', title: 'Customer Thank You Flow', content: 'Customer thank you flow.', order: 6, videoUrl: null, section: 'Retention Flows' },
      { id: '13-7', title: 'Customer Winback Flow', content: 'Customer winback flow.', order: 7, videoUrl: null, section: 'Retention Flows' },
      { id: '13-8', title: 'Customer Upsell Flow', content: 'Customer upsell flow.', order: 8, videoUrl: null, section: 'Retention Flows' },
      { id: '13-9', title: 'Sunset Unengaged Flow', content: 'Sunset unengaged flow.', order: 9, videoUrl: null, section: 'Retention Flows' },
      { id: '13-10', title: 'Back In Stock Flow', content: 'Back in stock flow.', order: 10, videoUrl: null, section: 'Retention Flows' },
      // Kampagnen
      { id: '13-11', title: 'Kampagnen 101', content: 'Campaigns 101 - creating campaigns, types, design, segmentation, sending frequency.', order: 11, videoUrl: null, section: 'Kampagnen' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course13Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 13 structure (08: Email Marketing - SOP Library) with 11 lessons and 3 sections')
  } catch (error) {
    console.error('Error updating Course 13 structure:', error)
  }
}

// Update Course 14 structure (09: CRO - SOP Library)
async function updateCourse14Structure() {
  try {
    const courseId = '14'
    const course14Lessons = [
      // Conversion Rate Optimization
      { id: '14-1', title: 'Carl Weische: Full CRO Guide', content: 'Full CRO guide with Carl Weische - conversion rate optimization.', order: 1, videoUrl: null, section: 'Conversion Rate Optimization' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course14Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 14 structure (09: CRO - SOP Library) with 1 lesson and 1 section')
  } catch (error) {
    console.error('Error updating Course 14 structure:', error)
  }
}

// Update Course 15 structure (13: Bulletproofing)
async function updateCourse15Structure() {
  try {
    const courseId = '15'
    const course15Lessons = [
      { id: '15-1', title: 'Intro', content: 'Introduction to bulletproofing your business.', order: 1, videoUrl: null, section: 'Bulletproofing' },
      { id: '15-2', title: 'Cyberangriffe', content: 'Protecting against cyber attacks.', order: 2, videoUrl: null, section: 'Bulletproofing' },
      { id: '15-3', title: 'Dein Lagerbestand', content: 'Your stock and inventory management.', order: 3, videoUrl: null, section: 'Bulletproofing' },
      { id: '15-4', title: 'Produkthaftung', content: 'Product liability.', order: 4, videoUrl: null, section: 'Bulletproofing' },
      { id: '15-5', title: 'Der juristische Part', content: 'The legal part.', order: 5, videoUrl: null, section: 'Bulletproofing' },
      { id: '15-6', title: 'Steueroptimiert Vermögen aufbauen', content: 'Building tax-optimized assets.', order: 6, videoUrl: null, section: 'Bulletproofing' },
      { id: '15-7', title: 'Gehaltsoptimierung der Mitarbeiter', content: 'Salary optimization for employees.', order: 7, videoUrl: null, section: 'Bulletproofing' },
      { id: '15-8', title: 'WICHTIG: Letzte Worte', content: 'Important: Final words.', order: 8, videoUrl: null, section: 'Bulletproofing' },
    ]

    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])

    for (const lesson of course15Lessons) {
      await dbRun(
        'INSERT OR REPLACE INTO lessons (id, course_id, title, content, video_url, order_index, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, lesson.videoUrl ?? null, lesson.order, lesson.section]
      )
    }

    console.log('Updated Course 15 structure (13: Bulletproofing) with 8 lessons')
  } catch (error) {
    console.error('Error updating Course 15 structure:', error)
  }
}

// Function to update a course structure (useful for updating individual courses)
export async function updateCourseStructure(courseId: string, lessons: Array<{id: string, title: string, content: string, order: number, videoUrl?: string}>) {
  try {
    // Delete existing lessons for this course
    await dbRun('DELETE FROM lessons WHERE course_id = ?', [courseId])
    
    // Insert new lessons
    for (const lesson of lessons) {
      const videoUrl = lesson.videoUrl || `https://placeholder-video.com/${courseId}/${lesson.id}`
      await dbRun(
        'INSERT INTO lessons (id, course_id, title, content, video_url, order_index) VALUES (?, ?, ?, ?, ?, ?)',
        [lesson.id, courseId, lesson.title, lesson.content, videoUrl, lesson.order]
      )
    }
    
    console.log(`Updated course ${courseId} with ${lessons.length} lessons`)
  } catch (error) {
    console.error(`Error updating course ${courseId}:`, error)
    throw error
  }
}

async function insertDefaultUser() {
  try {
    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', ['test@salino.com']) as any
    
    if (existingUser) {
      // Update existing user to be admin if not already
      if (!existingUser.is_admin) {
        await dbRun('UPDATE users SET is_admin = ? WHERE email = ?', [true, 'test@salino.com'])
        console.log('Updated default user to admin')
      }
      return
    }

    // Create default admin user
    const hashedPassword = await bcrypt.hash('test123', 10)
    const userId = 'test-user-001'
    
    await dbRun(
      'INSERT INTO users (id, name, email, password, is_admin) VALUES (?, ?, ?, ?, ?)',
      [userId, 'Test User', 'test@salino.com', hashedPassword, true]
    )

    console.log('Default admin user created')
    console.log('Email: test@salino.com')
    console.log('Password: test123')
    console.log('Role: Admin')
  } catch (error) {
    console.error('Error creating default user:', error)
  }
}
