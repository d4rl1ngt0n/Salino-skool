import { useParams, Link } from 'react-router-dom'
import { useCourses } from '../context/CourseContext'

const LessonDetail = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const { courses, getLesson, getCourseProgress, markLessonComplete, markLessonIncomplete } =
    useCourses()

  if (!courseId || !lessonId) {
    return <div>Invalid lesson</div>
  }

  const course = courses.find((c) => c.id === courseId)
  const lesson = getLesson(courseId, lessonId)
  const progress = getCourseProgress(courseId)
  const isCompleted = progress.lessonProgress[lessonId] === true

  if (!course || !lesson) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Lesson not found</h1>
        <Link to="/classroom" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
          Back to Classroom
        </Link>
      </div>
    )
  }

  // Find previous and next lessons
  const currentIndex = course.lessons.findIndex((l) => l.id === lessonId)
  const previousLesson = currentIndex > 0 ? course.lessons[currentIndex - 1] : null
  const nextLesson =
    currentIndex < course.lessons.length - 1 ? course.lessons[currentIndex + 1] : null

  const handleToggleComplete = () => {
    if (isCompleted) {
      markLessonIncomplete(courseId, lessonId)
    } else {
      markLessonComplete(courseId, lessonId)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm">
        <Link to="/classroom" className="text-primary-600 hover:text-primary-700 font-medium">
          Classroom
        </Link>
        <span className="text-gray-400">/</span>
        <Link to={`/classroom/${courseId}`} className="text-primary-600 hover:text-primary-700 font-medium">
          {course.title}
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-semibold">{lesson.title}</span>
      </div>

      {/* Lesson Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {lesson.title}
            </h1>
            <p className="text-gray-600 text-sm">
              Lesson {currentIndex + 1} of {course.lessons.length}
            </p>
          </div>
          <button
            onClick={handleToggleComplete}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              isCompleted
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isCompleted ? (
              <span className="flex items-center space-x-1.5">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Completed</span>
              </span>
            ) : (
              <span>Mark as Complete</span>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
            <span>Course Progress</span>
            <span className={`font-bold ${
              progress.percentage === 100 ? 'text-green-600' : 'text-indigo-600'
            }`}>
              {progress.percentage}%
            </span>
          </div>
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progress.percentage === 100 ? 'bg-green-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Lesson Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="prose max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {lesson.content}
          </p>
          {lesson.videoUrl && (
            <div className="mt-6">
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <svg className="h-12 w-12 text-gray-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  <p className="text-gray-500 text-sm">Video player would be embedded here</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            {previousLesson ? (
              <Link
                to={`/classroom/${courseId}/lesson/${previousLesson.id}`}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-indigo-600 hover:text-indigo-700 font-medium rounded-lg hover:bg-indigo-50 transition-all text-sm"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span>Previous</span>
              </Link>
            ) : (
              <div className="text-gray-400 px-4 py-2 text-sm">No previous lesson</div>
            )}
          </div>

          <Link
            to={`/classroom/${courseId}`}
            className="px-4 py-2 text-gray-600 hover:text-indigo-600 font-medium rounded-lg hover:bg-gray-50 transition-all text-sm"
          >
            Back to Course
          </Link>

          <div>
            {nextLesson ? (
              <Link
                to={`/classroom/${courseId}/lesson/${nextLesson.id}`}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow transition-all text-sm"
              >
                <span>Next</span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ) : (
              <div className="text-gray-400 px-4 py-2 text-sm">No next lesson</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LessonDetail
