import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CourseProvider } from './context/CourseContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Community from './pages/Community'
import Classroom from './pages/Classroom'
import CourseDetail from './pages/CourseDetail'
import Calendar from './pages/Calendar'
import Members from './pages/Members'
import Leaderboards from './pages/Leaderboards'
import About from './pages/About'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import AdminCourses from './pages/AdminCourses'
import AdminCourseEdit from './pages/AdminCourseEdit'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CourseProvider>
          <Router>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Community />} />
                    <Route path="/community" element={<Community />} />
                    <Route path="/classroom" element={<Classroom />} />
                    <Route path="/classroom/:courseId" element={<CourseDetail />} />
                    <Route
                      path="/classroom/:courseId/lesson/:lessonId"
                      element={<CourseDetail />}
                    />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/leaderboards" element={<Leaderboards />} />
                    <Route path="/about" element={<About />} />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/courses"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminCourses />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/courses/:courseId"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminCourseEdit />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </Layout>
              }
            />
            </Routes>
          </Router>
        </CourseProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
