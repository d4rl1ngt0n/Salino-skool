const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_ATTEMPTS = 3

const config = {
  siteBaseUrl: firstEnv('SMOKE_SITE_URL', 'SITE_BASE_URL', 'APP_BASE_URL'),
  apiBaseUrl: firstEnv('SMOKE_API_BASE_URL', 'API_BASE_URL'),
  email: firstEnv('SMOKE_EMAIL', 'COURSE_SMOKE_EMAIL'),
  password: firstEnv('SMOKE_PASSWORD', 'COURSE_SMOKE_PASSWORD'),
  courseId: firstEnv('SMOKE_COURSE_ID', 'COURSE_SMOKE_COURSE_ID'),
  lessonId: firstEnv('SMOKE_LESSON_ID', 'COURSE_SMOKE_LESSON_ID'),
  frontendPath: process.env.SMOKE_FRONTEND_PATH || '/',
  timeoutMs: Number(process.env.SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  attempts: Number(process.env.SMOKE_ATTEMPTS || DEFAULT_ATTEMPTS),
}

if (!config.apiBaseUrl && !config.siteBaseUrl) {
  fail('Set SMOKE_SITE_URL or SMOKE_API_BASE_URL.')
}

if (!config.email || !config.password) {
  fail('Set SMOKE_EMAIL and SMOKE_PASSWORD.')
}

const apiBaseUrl = normalizeUrl(config.apiBaseUrl || `${normalizeUrl(config.siteBaseUrl)}/api`)
const siteBaseUrl = config.siteBaseUrl ? normalizeUrl(config.siteBaseUrl) : null

console.log('Starting scheduled course smoke check')
console.log(`API base: ${apiBaseUrl}`)

if (siteBaseUrl) {
  await visitFrontend(siteBaseUrl, config.frontendPath)
}

const { token, user } = await login()
if (!token) {
  fail('Login response did not include a token.')
}

console.log(`Logged in as ${user?.email || config.email}`)

const authHeaders = {
  Authorization: `Bearer ${token}`,
}

await requestJson('/users/me', {
  headers: authHeaders,
  label: 'current user profile',
})

const courses = await requestJson('/courses', {
  label: 'course list',
})

if (!Array.isArray(courses) || courses.length === 0) {
  fail('No courses returned by /courses.')
}

const courseSummary = selectCourse(courses, config.courseId)
const course = await requestJson(`/courses/${encodeURIComponent(courseSummary.id)}`, {
  label: `course ${courseSummary.id}`,
})

const lessons = Array.isArray(course.lessons) ? course.lessons : []
if (lessons.length === 0) {
  fail(`Course ${courseSummary.id} has no lessons to access.`)
}

const lesson = selectLesson(lessons, config.lessonId)
await requestJson(
  `/courses/${encodeURIComponent(courseSummary.id)}/lessons/${encodeURIComponent(lesson.id)}`,
  {
    label: `lesson ${lesson.id}`,
  },
)

await requestJson(`/courses/${encodeURIComponent(courseSummary.id)}/progress`, {
  headers: authHeaders,
  label: `progress for course ${courseSummary.id}`,
})

console.log(`Accessed course "${course.title || courseSummary.title || courseSummary.id}" and lesson "${lesson.title || lesson.id}".`)
console.log('Scheduled course smoke check completed successfully')

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function normalizeUrl(value) {
  if (!value) return ''
  return value.replace(/\/+$/, '')
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function selectCourse(courses, requestedCourseId) {
  if (!requestedCourseId) {
    return courses[0]
  }

  const course = courses.find((item) => String(item.id) === String(requestedCourseId))
  if (!course) {
    fail(`Course ${requestedCourseId} was not found in /courses response.`)
  }
  return course
}

function selectLesson(lessons, requestedLessonId) {
  if (!requestedLessonId) {
    return lessons[0]
  }

  const lesson = lessons.find((item) => String(item.id) === String(requestedLessonId))
  if (!lesson) {
    fail(`Lesson ${requestedLessonId} was not found in the selected course response.`)
  }
  return lesson
}

async function visitFrontend(baseUrl, path) {
  const url = new URL(path || '/', `${baseUrl}/`).toString()
  const response = await fetchWithRetry(url, {
    label: `frontend ${url}`,
    expectJson: false,
  })

  if (response.status >= 500) {
    fail(`Frontend visit failed with status ${response.status}.`)
  }

  console.log(`Visited frontend route ${url} (${response.status})`)
}

async function login() {
  return requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
    label: 'login',
  })
}

async function requestJson(path, options = {}) {
  const url = path.startsWith('http') ? path : `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetchWithRetry(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'salino-course-smoke-check/1.0',
      ...options.headers,
    },
    body: options.body,
    label: options.label || path,
    expectJson: true,
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    fail(`${options.label || path} returned non-JSON response with status ${response.status}.`)
  }

  if (!response.ok) {
    const details = payload?.error || payload?.message || response.statusText
    fail(`${options.label || path} failed with status ${response.status}: ${details}`)
  }

  console.log(`Checked ${options.label || path} (${response.status})`)
  return payload
}

async function fetchWithRetry(url, options) {
  let lastError

  for (let attempt = 1; attempt <= config.attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {
          'User-Agent': 'salino-course-smoke-check/1.0',
        },
        body: options.body,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.status < 500 || attempt === config.attempts) {
        return response
      }

      lastError = new Error(`${options.label} returned ${response.status}`)
    } catch (error) {
      clearTimeout(timeout)
      lastError = error

      if (attempt === config.attempts) {
        break
      }
    }

    const delayMs = 1000 * attempt
    console.log(`${options.label} attempt ${attempt} failed; retrying in ${delayMs}ms`)
    await delay(delayMs)
  }

  fail(`${options.label} failed after ${config.attempts} attempts: ${lastError?.message || 'Unknown error'}`)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
