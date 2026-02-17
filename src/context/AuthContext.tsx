import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../services/api'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  isAdmin?: boolean
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    
    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as User
        setUser(parsed)
      } catch {
        // ignore invalid stored user
      }
      api.getCurrentUser().then((response) => {
        if (response.data) {
          setUser(response.data)
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        }
        setIsLoading(false)
      }).catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password)
    
    if (response.error) {
      throw new Error(response.error)
    }
    
    if (response.data) {
      const { user: userData, token } = response.data
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('token', token)
    }
  }

  const signup = async (name: string, email: string, password: string) => {
    const response = await api.signup(name, email, password)
    
    if (response.error) {
      throw new Error(response.error)
    }
    
    if (response.data) {
      const { user: userData, token } = response.data
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('token', token)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
