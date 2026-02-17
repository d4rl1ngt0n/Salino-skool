import { Link } from 'react-router-dom'
import { useCourses } from '../context/CourseContext'

const AdminCourses = () => {
  const { courses, isLoading } = useCourses()

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage courses & lessons</h1>
      <p className="text-gray-600 mb-6">
        Choose a course to edit its title, description, and lessons (add, edit, reorder, delete).
      </p>
      <ul className="space-y-2">
        {courses
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((course) => (
            <li key={course.id}>
              <Link
                to={`/admin/courses/${course.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-indigo-200 transition-colors"
              >
                <span className="font-medium text-gray-900">{course.title}</span>
                <span className="text-sm text-gray-500">
                  {course.lessons.length} lesson{course.lessons.length !== 1 ? 's' : ''}
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  )
}

export default AdminCourses
