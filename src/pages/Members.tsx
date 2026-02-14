import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

interface Member {
  id: string
  name: string
  email: string
  role: 'member' | 'admin'
  joinedDate: string
  coursesCompleted: number
  online: boolean
}

const Members = () => {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [members] = useState<Member[]>([
    {
      id: '1',
      name: 'Test User',
      email: 'test@salino.com',
      role: 'member',
      joinedDate: '2024-01-15',
      coursesCompleted: 2,
      online: true,
    },
    {
      id: '2',
      name: 'Admin User',
      email: 'admin@salino.com',
      role: 'admin',
      joinedDate: '2024-01-01',
      coursesCompleted: 5,
      online: true,
    },
  ])

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const onlineCount = members.filter(m => m.online).length
  const adminCount = members.filter(m => m.role === 'admin').length

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Members</h1>
        <div className="mt-3 flex items-center space-x-6 text-sm text-gray-600">
          <span className="font-medium">{members.length} Members</span>
          <span className="font-medium">{onlineCount} Online</span>
          <span className="font-medium">{adminCount} Admins</span>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="relative">
          <input
            type="text"
            placeholder="Search members by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200 shadow-sm overflow-hidden">
        {filteredMembers.map((member) => (
          <div key={member.id} className="p-5 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  {member.online && (
                    <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{member.name}</h3>
                    {member.role === 'admin' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{member.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Joined {new Date(member.joinedDate).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })} • {member.coursesCompleted} courses completed
                  </p>
                </div>
              </div>
              {member.id === user?.id && (
                <span className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full">You</span>
              )}
            </div>
          </div>
        ))}
        {filteredMembers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No members found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Members
