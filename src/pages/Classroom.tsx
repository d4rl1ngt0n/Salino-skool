import { Link } from 'react-router-dom'
import { useCourses } from '../context/CourseContext'
import { TitleThumbnail } from '../components/TitleThumbnail'

const Classroom = () => {
  const { courses, progress } = useCourses()

  // Bold uppercase label for the card thumbnail (like reference: ONBOARDING, META ADS 2.0, FACEBOOK ADS)
  const getCardTitle = (title: string): string => {
    if (title.includes('Intro & Onboarding')) return 'Onboarding'
    if (title.includes('Cold Friendly Offer')) return 'Offer Creation'
    if (title.includes('Meta Ads')) return 'Meta Ads'
    if (title.includes('Facebook Ads')) return 'Facebook Ads'
    if (title.includes('Google Ads')) return 'Google Ads'
    if (title.includes('TikTok Ads')) return 'TikTok Ads'
    if (title.includes('Creative Frameworks')) return 'Creative Frameworks'
    if (title.includes('Direct Response')) return 'Direct Response'
    if (title.includes('Brand Strategy')) return 'Brand Strategy'
    if (title.includes('Email Marketing')) return 'Email Marketing'
    if (title.includes('CRO')) return 'CRO'
    if (title.includes('Bulletproofing')) return 'Bulletproofing'
    return title.replace(/^\d+:\s*/i, '').split(' - ')[0]?.trim() || 'Course'
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Classroom</h1>
        <p className="text-gray-600">
          Explore our comprehensive courses and track your learning journey
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => {
          const courseProgress = progress[course.id] || {
            courseId: course.id,
            lessonProgress: {},
            completedLessons: 0,
            totalLessons: course.lessons.length,
            percentage: 0,
          }

          const isComplete = courseProgress.percentage === 100

          return (
            <Link
              key={course.id}
              to={`/classroom/${course.id}`}
              className="group block bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden"
            >
              {/* Thumbnail card: bold topic + subtitle (reference style) */}
              <div className="aspect-[4/3] min-h-[140px] w-full overflow-hidden">
                <TitleThumbnail
                  variant="card"
                  title={getCardTitle(course.title)}
                  subtitle="Salino GmbH - SOP Library"
                  className="w-full h-full"
                />
              </div>
              <div className="p-4">
                {/* Course title (lesson descriptor below the card) */}
                <h2 className="text-sm font-bold text-gray-900 mb-2 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {course.title}
                </h2>
                {course.description && (
                  <p className="text-xs text-gray-500 mb-2 line-clamp-1">{course.description}</p>
                )}
                <div className="flex items-center text-xs text-gray-500 mb-3">
                  <svg className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>{course.lessons.length} lessons</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600">Progress</span>
                  <span className={`text-sm font-bold ${
                    isComplete ? 'text-green-600' : 'text-indigo-600'
                  }`}>
                    {courseProgress.percentage}%
                  </span>
                </div>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isComplete ? 'bg-green-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${courseProgress.percentage}%` }}
                  />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default Classroom
