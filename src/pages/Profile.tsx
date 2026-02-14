import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const Profile = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Header with Avatar */}
        <div className="px-6 py-6 bg-indigo-50 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-600 text-sm mt-0.5">{user.email}</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-6 space-y-5">
          {/* User Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name
              </label>
              <div className="text-base text-gray-900">{user.name}</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="text-base text-gray-900">{user.email}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Member Since
              </label>
              <div className="text-base text-gray-900">
                {new Date(parseInt(user.id)).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-5 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm hover:shadow transition-all"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
