import { useAuth } from '../context/AuthContext'
import { useCourses } from '../context/CourseContext'
import { useEffect, useState } from 'react'

interface LeaderboardEntry {
  userId: string
  name: string
  totalCourses: number
  completedCourses: number
  totalLessons: number
  completedLessons: number
  points: number
}

const Leaderboards = () => {
  const { user } = useAuth()
  const { courses, progress } = useCourses()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    // Calculate leaderboard from progress
    // In a real app, this would come from the backend
    const entries: LeaderboardEntry[] = []
    
    if (user) {
      let totalLessons = 0
      let completedLessons = 0
      let completedCourses = 0

      courses.forEach((course) => {
        const courseProgress = progress[course.id]
        if (courseProgress) {
          totalLessons += course.lessons.length
          completedLessons += courseProgress.completedLessons
          if (courseProgress.percentage === 100) {
            completedCourses++
          }
        } else {
          totalLessons += course.lessons.length
        }
      })

      const points = completedLessons * 10 + completedCourses * 50

      entries.push({
        userId: user.id,
        name: user.name,
        totalCourses: courses.length,
        completedCourses,
        totalLessons,
        completedLessons,
        points,
      })
    }

    // Sort by points
    entries.sort((a, b) => b.points - a.points)
    setLeaderboard(entries)
  }, [user, courses, progress])

  const getRankIcon = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Leaderboards</h1>
        <p className="text-gray-600">
          Top performers based on course completion and engagement
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Member</div>
            <div className="col-span-2 text-center">Courses</div>
            <div className="col-span-2 text-center">Lessons</div>
            <div className="col-span-3 text-right">Points</div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => (
              <div
                key={entry.userId}
                className={`px-6 py-4 grid grid-cols-12 gap-4 items-center ${
                  entry.userId === user?.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                } transition-colors`}
              >
                <div className="col-span-1 text-lg font-bold">
                  {index < 3 ? (
                    <span className="text-xl">{getRankIcon(index)}</span>
                  ) : (
                    <span className="text-indigo-600">#{index + 1}</span>
                  )}
                </div>
                <div className="col-span-4 flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {entry.name}
                      {entry.userId === user?.id && (
                        <span className="ml-2 text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">You</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-center text-sm text-gray-700">
                  {entry.completedCourses} / {entry.totalCourses}
                </div>
                <div className="col-span-2 text-center text-sm text-gray-700">
                  {entry.completedLessons} / {entry.totalLessons}
                </div>
                <div className="col-span-3 text-right">
                  <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 font-semibold rounded text-sm">
                    {entry.points.toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center text-gray-500">
              <p className="font-medium">No leaderboard data available yet.</p>
              <p className="text-sm mt-2">Complete courses to earn points and climb the leaderboard!</p>
            </div>
          )}
        </div>
      </div>

      {/* Points System Info */}
      <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Points System</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>• Complete a lesson: <span className="font-semibold text-indigo-600">10 points</span></li>
          <li>• Complete a course: <span className="font-semibold text-indigo-600">50 bonus points</span></li>
        </ul>
      </div>
    </div>
  )
}

export default Leaderboards
