import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import logoUrl from '../assets/logo.avif'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLinks = [
    { path: '/community', label: 'Community' },
    { path: '/classroom', label: 'Classroom' },
    { path: '/calendar', label: 'Calendar' },
    { path: '/members', label: 'Members' },
    { path: '/leaderboards', label: 'Leaderboards' },
    { path: '/about', label: 'About' },
    ...(user ? [{ path: '/admin/courses', label: 'Manage courses' }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
          <div className="flex items-center justify-between h-16 gap-2 min-w-0">
            {/* Logo */}
            <Link to="/" className="flex items-center group flex-shrink-0 min-w-0 overflow-hidden">
              <img
                src={logoUrl}
                alt="Salino"
                className="h-8 sm:h-10 w-auto max-h-10 object-contain object-left group-hover:opacity-90 transition-opacity"
              />
            </Link>

            {/* Search Bar */}
            <div className="flex-1 max-w-xl mx-8 hidden md:block">
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search courses, members, posts..."
                  className="w-full px-4 py-2 pl-10 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* User Actions */}
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline">{user.name}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition-all"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation - scrollable on mobile so all links visible without truncation */}
        <nav className="bg-white border-t border-gray-200 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                    location.pathname === link.path
                      ? 'text-indigo-600 border-indigo-600'
                      : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content - prevent horizontal overflow on mobile */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 w-full min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}

export default Layout
