import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

interface Post {
  id: string
  author: string
  content: string
  timestamp: string
  likes: number
  comments: number
}

const Community = () => {
  const { user } = useAuth()
  const [newPost, setNewPost] = useState('')
  const [posts] = useState<Post[]>([
    {
      id: '1',
      author: 'Test User',
      content: 'Welcome to the Salino GmbH community! This is a great place to share knowledge and connect with other members.',
      timestamp: '2 hours ago',
      likes: 5,
      comments: 2,
    },
    {
      id: '2',
      author: 'Admin',
      content: 'New course content has been added to the Classroom. Check out the latest lessons!',
      timestamp: '1 day ago',
      likes: 12,
      comments: 4,
    },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPost.trim()) {
      // In a real app, this would create a post via API
      console.log('Creating post:', newPost)
      setNewPost('')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Community</h1>
        <p className="text-gray-600">
          Connect with other members and share your thoughts
        </p>
      </div>

      {/* Create Post */}
      {user && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none bg-white"
              rows={4}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newPost.trim()}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all"
              >
                Post
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-4">
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {post.author.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="font-semibold text-gray-900">{post.author}</h3>
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-gray-500">{post.timestamp}</span>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">{post.content}</p>
                <div className="flex items-center space-x-6 text-sm">
                  <button className="flex items-center space-x-1.5 text-gray-600 hover:text-indigo-600 transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="font-medium">{post.likes}</span>
                  </button>
                  <button className="flex items-center space-x-1.5 text-gray-600 hover:text-indigo-600 transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="font-medium">{post.comments}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Community
