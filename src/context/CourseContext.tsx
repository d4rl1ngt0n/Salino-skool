import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Course, CourseProgress, Lesson } from '../types/course'
import { useAuth } from './AuthContext'
import { api } from '../services/api'

interface CourseContextType {
  courses: Course[]
  progress: { [courseId: string]: CourseProgress }
  markLessonComplete: (courseId: string, lessonId: string) => Promise<void>
  markLessonIncomplete: (courseId: string, lessonId: string) => Promise<void>
  getCourseProgress: (courseId: string) => CourseProgress
  getLesson: (courseId: string, lessonId: string) => Lesson | undefined
  refreshCourses: () => Promise<void>
  isLoading: boolean
}

const CourseContext = createContext<CourseContextType | undefined>(undefined)

export const useCourses = () => {
  const context = useContext(CourseContext)
  if (context === undefined) {
    throw new Error('useCourses must be used within a CourseProvider')
  }
  return context
}

interface CourseProviderProps {
  children: ReactNode
}

export const CourseProvider = ({ children }: CourseProviderProps) => {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [progress, setProgress] = useState<{ [courseId: string]: CourseProgress }>({})
  const [isLoading, setIsLoading] = useState(true)

  // Load courses and progress
  useEffect(() => {
    loadCourses()
    if (user) {
      loadProgress()
    }
  }, [user])

  const loadCourses = async () => {
    try {
      const response = await api.getCourses()
      if (response.data) {
        // Transform API response to Course format
        const transformedCourses: Course[] = response.data.map((course: any) => ({
          id: course.id,
          title: course.title,
          description: course.description,
          thumbnailUrl: course.thumbnail_url,
          order: course.order_index,
          lessons: (course.lessons || []).map((lesson: any) => ({
            id: lesson.id,
            title: lesson.title,
            content: lesson.content,
            videoUrl: lesson.video_url,
            order: lesson.order_index,
            section: lesson.section,
          })),
        }))
        setCourses(transformedCourses)
      }
    } catch (error) {
      console.error('Failed to load courses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadProgress = async () => {
    if (!user) return

    try {
      const response = await api.getAllProgress()
      if (response.data) {
        // Transform API progress to our format
        const progressMap: { [courseId: string]: CourseProgress } = {}

        // Group by course
        const progressByCourse: { [courseId: string]: any[] } = {}
        response.data.forEach((item: any) => {
          if (!progressByCourse[item.course_id]) {
            progressByCourse[item.course_id] = []
          }
          progressByCourse[item.course_id].push(item)
        })

        // Calculate progress for each course
        courses.forEach((course) => {
          const courseProgress = progressByCourse[course.id] || []
          const lessonProgress: { [lessonId: string]: boolean } = {}
          
          courseProgress.forEach((item: any) => {
            if (item.completed) {
              lessonProgress[item.lesson_id] = true
            }
          })

          const completedLessons = Object.values(lessonProgress).filter(Boolean).length
          const percentage = Math.round((completedLessons / course.lessons.length) * 100)

          progressMap[course.id] = {
            courseId: course.id,
            lessonProgress,
            completedLessons,
            totalLessons: course.lessons.length,
            percentage,
          }
        })

        setProgress(progressMap)
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  // Reload progress when courses change
  useEffect(() => {
    if (user && courses.length > 0) {
      loadProgress()
    }
  }, [courses, user])

  const calculateProgress = (courseId: string): CourseProgress => {
    const course = courses.find((c) => c.id === courseId)
    if (!course) {
      return {
        courseId,
        lessonProgress: {},
        completedLessons: 0,
        totalLessons: 0,
        percentage: 0,
      }
    }

    const currentProgress = progress[courseId] || {
      courseId,
      lessonProgress: {},
      completedLessons: 0,
      totalLessons: course.lessons.length,
      percentage: 0,
    }

    const completedLessons = Object.values(currentProgress.lessonProgress).filter(
      (completed) => completed
    ).length
    const percentage = Math.round((completedLessons / course.lessons.length) * 100)

    return {
      ...currentProgress,
      completedLessons,
      totalLessons: course.lessons.length,
      percentage,
    }
  }

  const markLessonComplete = async (courseId: string, lessonId: string) => {
    if (!user) return

    try {
      const response = await api.updateLessonProgress(courseId, lessonId, true)
      if (response.error) {
        console.error('Failed to update progress:', response.error)
        return
      }

      // Update local state
      setProgress((prev) => {
        const courseProgress = prev[courseId] || {
          courseId,
          lessonProgress: {},
          completedLessons: 0,
          totalLessons: courses.find((c) => c.id === courseId)?.lessons.length || 0,
          percentage: 0,
        }

        const updatedLessonProgress = {
          ...courseProgress.lessonProgress,
          [lessonId]: true,
        }

        const course = courses.find((c) => c.id === courseId)
        const completedLessons = Object.values(updatedLessonProgress).filter(Boolean).length
        const percentage = course
          ? Math.round((completedLessons / course.lessons.length) * 100)
          : 0

        return {
          ...prev,
          [courseId]: {
            ...courseProgress,
            lessonProgress: updatedLessonProgress,
            completedLessons,
            percentage,
          },
        }
      })
    } catch (error) {
      console.error('Failed to mark lesson complete:', error)
    }
  }

  const markLessonIncomplete = async (courseId: string, lessonId: string) => {
    if (!user) return

    try {
      const response = await api.updateLessonProgress(courseId, lessonId, false)
      if (response.error) {
        console.error('Failed to update progress:', response.error)
        return
      }

      // Update local state
      setProgress((prev) => {
        const courseProgress = prev[courseId]
        if (!courseProgress) return prev

        const updatedLessonProgress = {
          ...courseProgress.lessonProgress,
          [lessonId]: false,
        }

        const course = courses.find((c) => c.id === courseId)
        const completedLessons = Object.values(updatedLessonProgress).filter(Boolean).length
        const percentage = course
          ? Math.round((completedLessons / course.lessons.length) * 100)
          : 0

        return {
          ...prev,
          [courseId]: {
            ...courseProgress,
            lessonProgress: updatedLessonProgress,
            completedLessons,
            percentage,
          },
        }
      })
    } catch (error) {
      console.error('Failed to mark lesson incomplete:', error)
    }
  }

  const getCourseProgress = (courseId: string): CourseProgress => {
    return calculateProgress(courseId)
  }

  const getLesson = (courseId: string, lessonId: string): Lesson | undefined => {
    const course = courses.find((c) => c.id === courseId)
    return course?.lessons.find((l) => l.id === lessonId)
  }

  const refreshCourses = async () => {
    await loadCourses()
    if (user) await loadProgress()
  }

  return (
    <CourseContext.Provider
      value={{
        courses,
        progress,
        markLessonComplete,
        markLessonIncomplete,
        getCourseProgress,
        getLesson,
        refreshCourses,
        isLoading,
      }}
    >
      {children}
    </CourseContext.Provider>
  )
}
