export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  // Always hit backend directly so login works (backend has CORS enabled)
  const defaultUrl = 'http://localhost:3001/api'
  return (envUrl ?? defaultUrl).replace(/\/$/, '')
}

/** Backend origin (no /api path) for file downloads etc. */
export const getApiOrigin = () => {
  const base = getApiBaseUrl()
  return base.replace(/\/api\/?$/, '') || base
}

const API_BASE_URL = getApiBaseUrl()

export interface ApiResponse<T> {
  data?: T
  error?: string
}

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    }

    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

    try {
      const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
        ...options,
        headers,
      })

      let data
      try {
        data = await response.json()
      } catch (e) {
        // If response is not JSON, return error
        return { error: `Server error: ${response.status} ${response.statusText}` }
      }

      if (!response.ok) {
        const message = data?.error || `Request failed: ${response.status} ${response.statusText}`
        const hint = response.status === 404 && import.meta.env.DEV
          ? ' Make sure the backend is running (e.g. run `npm run dev` in the server folder).'
          : ''
        return { error: message + hint }
      }

      return { data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      // Check if it's a connection error
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        return { error: 'Cannot connect to server. Make sure the backend is running on http://localhost:3001' }
      }
      return { error: errorMessage }
    }
  }

  // Auth endpoints
  async signup(name: string, email: string, password: string) {
    return this.request<{ user: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
  }

  async login(email: string, password: string) {
    return this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  // Course endpoints
  async getCourses() {
    return this.request<any[]>('/courses')
  }

  async getCourse(courseId: string) {
    return this.request<any>(`/courses/${courseId}`)
  }

  async getLesson(courseId: string, lessonId: string) {
    return this.request<any>(`/courses/${courseId}/lessons/${lessonId}`)
  }

  async getCourseProgress(courseId: string) {
    return this.request<any[]>(`/courses/${courseId}/progress`)
  }

  async getAllProgress() {
    return this.request<any[]>('/courses/progress/all')
  }

  async updateLessonProgress(
    courseId: string,
    lessonId: string,
    completed: boolean
  ) {
    return this.request<{ success: boolean }>(
      `/courses/${courseId}/lessons/${lessonId}/progress`,
      {
        method: 'POST',
        body: JSON.stringify({ completed }),
      }
    )
  }

  // User endpoints
  async getCurrentUser() {
    return this.request<any>('/users/me')
  }

  // Resource endpoints
  async getResources(courseId?: string, lessonId?: string) {
    const params = new URLSearchParams()
    if (courseId) params.append('course_id', courseId)
    if (lessonId) params.append('lesson_id', lessonId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request<any[]>(`/resources${query}`)
  }

  async getResource(resourceId: string) {
    return this.request<any>(`/resources/${resourceId}`)
  }

  async uploadResource(
    resourceType: 'file' | 'url',
    courseId: string,
    title: string,
    description?: string,
    lessonId?: string,
    file?: File,
    externalUrl?: string
  ) {
    const formData = new FormData()
    formData.append('resource_type', resourceType)
    formData.append('course_id', courseId)
    formData.append('title', title)
    if (description) formData.append('description', description)
    if (lessonId) formData.append('lesson_id', lessonId)
    
    if (resourceType === 'file' && file) {
      formData.append('file', file)
    } else if (resourceType === 'url' && externalUrl) {
      formData.append('external_url', externalUrl)
    }

    const token = this.getToken()
    const headers: HeadersInit = {
      ...(token && { Authorization: `Bearer ${token}` }),
    }

    const normalizedEndpoint = '/resources'
    try {
      const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      })

      let data
      try {
        data = await response.json()
      } catch (e) {
        return { error: `Server error: ${response.status} ${response.statusText}` }
      }

      if (!response.ok) {
        return { error: data.error || `Failed to upload resource: ${response.status} ${response.statusText}` }
      }
      return { data: data.data || data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      return { error: `Upload failed: ${errorMessage}` }
    }
  }

  async deleteResource(resourceId: string) {
    return this.request<{ message: string }>(`/resources/${resourceId}`, {
      method: 'DELETE',
    })
  }

  // Admin endpoints for course management
  async updateLessonVideo(courseId: string, lessonId: string, videoUrl: string) {
    return this.request<any>(`/courses/${courseId}/lessons/${lessonId}/video`, {
      method: 'PUT',
      body: JSON.stringify({ videoUrl }),
    })
  }

  async updateLesson(courseId: string, lessonId: string, data: { title?: string; content?: string; videoUrl?: string }) {
    return this.request<any>(`/courses/${courseId}/lessons/${lessonId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async updateCourse(courseId: string, data: { title?: string; description?: string }) {
    return this.request<any>(`/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()
