export interface Lesson {
  id: string
  title: string
  content: string
  videoUrl?: string
  order: number
  section?: string
}

export interface Course {
  id: string
  title: string
  description?: string
  thumbnailUrl?: string
  lessons: Lesson[]
  order: number
}

export interface CourseProgress {
  courseId: string
  lessonProgress: {
    [lessonId: string]: boolean // true if completed
  }
  completedLessons: number
  totalLessons: number
  percentage: number
}
