import { useParams, Link, useNavigate } from 'react-router-dom'
import { useCourses } from '../context/CourseContext'
import { useAuth } from '../context/AuthContext'
import { api, getApiOrigin } from '../services/api'
import { TitleThumbnail } from '../components/TitleThumbnail'
import { useState, useEffect } from 'react'

interface Resource {
  id: string
  courseId: string
  lessonId?: string
  title: string
  description?: string
  resourceType?: 'file' | 'url'
  fileUrl?: string
  fileName?: string
  fileSize?: number
  fileType?: string
  externalUrl?: string
  uploadedBy: string
  createdAt: string
}

const CourseDetail = () => {
  const { courseId, lessonId } = useParams<{ courseId?: string; lessonId?: string }>()
  const { courses, progress, getLesson, getCourseProgress, markLessonComplete, markLessonIncomplete, isLoading } = useCourses()
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [resources, setResources] = useState<Resource[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showEditVideoModal, setShowEditVideoModal] = useState(false)
  const [showEditLessonModal, setShowEditLessonModal] = useState(false)
  const [uploadData, setUploadData] = useState({
    resourceType: 'file' as 'file' | 'url',
    lessonId: '',
    title: '',
    description: '',
    file: null as File | null,
    externalUrl: '',
  })
  const [editVideoData, setEditVideoData] = useState({
    videoUrl: '',
  })
  const [editLessonData, setEditLessonData] = useState({
    title: '',
    content: '',
    videoUrl: '',
  })

  const course = courseId ? courses.find((c) => c.id === courseId) : undefined

  const loadResources = async () => {
    if (!courseId) {
      setResources([])
      return
    }
    // Only load resources if user is authenticated
    if (!user) {
      setResources([])
      return
    }
    try {
      // Fetch resources for this lesson only (+ course-level). So a resource added to lesson A does not show under lesson B.
      const response = await api.getResources(courseId, selectedLessonId || undefined)
      if (response && response.data) {
        // Ensure response.data is an array
        let resourcesData: Resource[] = []
        if (Array.isArray(response.data)) {
          resourcesData = response.data
        } else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = (response.data as any).data
          resourcesData = Array.isArray(nestedData) ? nestedData : []
        }
        setResources(resourcesData)
      } else if (response && response.error) {
        // If error is about authentication, just set empty resources
        console.warn('Could not load resources:', response.error)
        setResources([])
      } else {
        setResources([])
      }
    } catch (error) {
      console.error('Failed to load resources:', error)
      setResources([])
    }
  }

  useEffect(() => {
    if (lessonId) {
      setSelectedLessonId(lessonId)
    } else if (course && course.lessons && Array.isArray(course.lessons) && course.lessons.length > 0) {
      // Auto-select first lesson if none selected
      setSelectedLessonId(course.lessons[0].id)
    }
  }, [lessonId, course])

  // Expand all sections by default when course has sections
  useEffect(() => {
    if (course?.lessons) {
      const sections = [...new Set(course.lessons.map((l) => l.section).filter(Boolean))] as string[]
      setExpandedSections(new Set(sections))
    }
  }, [course?.id])

  useEffect(() => {
    if (courseId) {
      loadResources()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, selectedLessonId, user])

  // Show loading state while data is being fetched (AFTER all hooks)
  if (isLoading || authLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileType?: string, resourceType?: string) => {
    if (resourceType === 'url') return '🔗'
    if (!fileType) return '📎'
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊'
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('video')) return '🎥'
    return '📎'
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadData({ ...uploadData, file: e.target.files[0] })
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadData.title || !courseId) {
      alert('Please fill in all required fields')
      return
    }

    if (uploadData.resourceType === 'file' && !uploadData.file) {
      alert('Please select a file to upload')
      return
    }

    if (uploadData.resourceType === 'url' && !uploadData.externalUrl) {
      alert('Please enter a URL')
      return
    }

    try {
      const response = await api.uploadResource(
        uploadData.resourceType,
        courseId,
        uploadData.title,
        uploadData.description || undefined,
        uploadData.lessonId || undefined,
        uploadData.file || undefined,
        uploadData.externalUrl || undefined
      )

      if (response.data) {
        setShowUploadModal(false)
        setUploadData({
          resourceType: 'file',
          lessonId: '',
          title: '',
          description: '',
          file: null,
          externalUrl: '',
        })
        loadResources()
      } else {
        console.error('Upload error response:', response)
        const errorMsg = response.error || 'Failed to upload resource'
        alert(`Upload failed: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      alert(`Upload failed: ${errorMsg}`)
    }
  }

  const handleDelete = async (resourceId: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) {
      return
    }

    try {
      const response = await api.deleteResource(resourceId)
      if (response.data) {
        loadResources()
      } else {
        alert(response.error || 'Failed to delete resource')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete resource')
    }
  }

  const handleEditVideo = () => {
    if (selectedLesson) {
      setEditVideoData({ videoUrl: selectedLesson.videoUrl || '' })
      setShowEditVideoModal(true)
    }
  }

  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId || !selectedLessonId) return

    try {
      const response = await api.updateLessonVideo(courseId, selectedLessonId, editVideoData.videoUrl)
      if (response.data) {
        setShowEditVideoModal(false)
        // Reload course data
        window.location.reload()
      } else {
        alert(response.error || 'Failed to update video')
      }
    } catch (error) {
      console.error('Update video error:', error)
      alert('Failed to update video')
    }
  }

  const handleEditLesson = () => {
    if (selectedLesson) {
      setEditLessonData({
        title: selectedLesson.title,
        content: selectedLesson.content || '',
        videoUrl: selectedLesson.videoUrl || '',
      })
      setShowEditLessonModal(true)
    }
  }

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId || !selectedLessonId) return

    try {
      const response = await api.updateLesson(courseId, selectedLessonId, editLessonData)
      if (response.data) {
        setShowEditLessonModal(false)
        // Reload course data
        window.location.reload()
      } else {
        alert(response.error || 'Failed to update lesson')
      }
    } catch (error) {
      console.error('Update lesson error:', error)
      alert('Failed to update lesson')
    }
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Course not found</h1>
        <Link to="/classroom" className="text-indigo-600 hover:text-indigo-700 mt-4 inline-block">
          Back to Classroom
        </Link>
      </div>
    )
  }

  if (!course.lessons || course.lessons.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
        <p className="text-gray-600 mt-2">This course has no lessons yet.</p>
        <Link to="/classroom" className="text-indigo-600 hover:text-indigo-700 mt-4 inline-block">
          Back to Classroom
        </Link>
      </div>
    )
  }

  const courseProgress = progress[course.id] || {
    courseId: course.id,
    lessonProgress: {},
    completedLessons: 0,
    totalLessons: course.lessons?.length || 0,
    percentage: 0,
  }

  const selectedLesson = selectedLessonId && courseId ? getLesson(courseId, selectedLessonId) : null
  const lessonProgress = courseId ? getCourseProgress(courseId) : { lessonProgress: {} as { [key: string]: boolean }, percentage: 0, completedLessons: 0, totalLessons: 0 }
  const isLessonCompleted = selectedLesson && selectedLesson.id ? (lessonProgress.lessonProgress[selectedLesson.id] === true) : false

  const handleLessonClick = (lessonId: string) => {
    setSelectedLessonId(lessonId)
    navigate(`/classroom/${courseId}/lesson/${lessonId}`, { replace: true })
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  // Group lessons by section (preserve order)
  const hasSections = course?.lessons?.some((l) => l.section)
  const sectionGroups = hasSections && course?.lessons
    ? (() => {
        const seen = new Set<string>()
        const order: string[] = []
        course.lessons.forEach((l) => {
          const s = l.section || '__none__'
          if (!seen.has(s)) {
            seen.add(s)
            order.push(s)
          }
        })
        const groups: { section: string; lessons: typeof course.lessons }[] = []
        order.forEach((sec) => {
          const lessons = course.lessons!.filter((l) => (l.section || '__none__') === sec)
          groups.push({ section: sec, lessons })
        })
        return groups
      })()
    : null

  const handleToggleComplete = () => {
    if (!selectedLessonId || !courseId) return
    if (isLessonCompleted) {
      markLessonIncomplete(courseId, selectedLessonId)
    } else {
      markLessonComplete(courseId, selectedLessonId)
    }
  }

  // Find current lesson index
  const currentIndex = selectedLessonId && course && course.lessons && Array.isArray(course.lessons)
    ? course.lessons.findIndex((l) => l.id === selectedLessonId)
    : -1
  const previousLesson = currentIndex > 0 && course && course.lessons && Array.isArray(course.lessons) ? course.lessons[currentIndex - 1] : null
  const nextLesson = currentIndex >= 0 && course && course.lessons && Array.isArray(course.lessons) && currentIndex < course.lessons.length - 1 ? course.lessons[currentIndex + 1] : null

  return (
    <div className="flex flex-col lg:flex-row border border-gray-200 rounded-lg overflow-hidden min-w-0 lg:h-[calc(100vh-14rem)]">
      {/* Left Sidebar - full width on mobile, fixed width on desktop; scrollable on mobile */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col overflow-hidden max-h-[45vh] lg:max-h-none">
        {/* Course Header */}
        <div className="p-6 border-b border-gray-200">
          <Link
            to="/classroom"
            className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-4 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Classroom</span>
          </Link>
          {/* Course thumbnail: card style with topic + subtitle */}
          <div className="aspect-video w-full rounded-lg overflow-hidden mb-3 border border-gray-200">
            <TitleThumbnail
              variant="card"
              title={course.lessons?.length ? course.lessons[0].title : course.title}
              subtitle="Salino GmbH - SOP Library"
              className="w-full h-full rounded-lg"
            />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 mb-3 leading-tight">
            {course.title}
          </h1>
          {course.description && (
            <p className="text-sm text-gray-600 mb-4">{course.description}</p>
          )}
          
          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">Progress</span>
              <span className={`text-sm font-bold ${
                courseProgress.percentage === 100 ? 'text-green-600' : 'text-indigo-600'
              }`}>
                {courseProgress.percentage}%
              </span>
            </div>
            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  courseProgress.percentage === 100 ? 'bg-green-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${courseProgress.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Lessons List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-2">
              Lessons
            </h2>
            <div className="space-y-1">
              {sectionGroups ? (
                sectionGroups.map(({ section, lessons }) => {
                  const sectionLabel = section === '__none__' ? null : section
                  const isExpanded = sectionLabel ? expandedSections.has(sectionLabel) : true

                  return (
                    <div key={section} className="space-y-0.5">
                      {sectionLabel ? (
                        <button
                          onClick={() => toggleSection(sectionLabel)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <span>{sectionLabel}</span>
                          <svg
                            className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : null}
                      {(sectionLabel ? isExpanded : true) && lessons.map((lesson) => {
                        const isCompleted = courseProgress.lessonProgress[lesson.id] === true
                        const isSelected = selectedLessonId === lesson.id

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => handleLessonClick(lesson.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group pl-5 ${
                              isSelected
                                ? 'bg-indigo-100 text-indigo-900'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {isCompleted ? (
                                  <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                                    <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                ) : (
                                  <TitleThumbnail
                                    title={lesson.title}
                                    seed={lesson.id}
                                    compact
                                    className="h-6 w-6 rounded-full min-w-[1.5rem]"
                                  />
                                )}
                              </div>
                              <span className={`text-sm font-medium flex-1 truncate ${
                                isSelected ? 'text-indigo-900' : 'text-gray-900'
                              }`}>
                                {lesson.title}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              ) : (
                course.lessons && Array.isArray(course.lessons) && course.lessons.map((lesson) => {
                  const isCompleted = courseProgress.lessonProgress[lesson.id] === true
                  const isSelected = selectedLessonId === lesson.id

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => handleLessonClick(lesson.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                        isSelected
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <TitleThumbnail
                              title={lesson.title}
                              seed={lesson.id}
                              compact
                              className="h-6 w-6 rounded-full min-w-[1.5rem]"
                            />
                          )}
                        </div>
                        <span className={`text-sm font-medium flex-1 truncate ${
                          isSelected ? 'text-indigo-900' : 'text-gray-900'
                        }`}>
                          {lesson.title}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - min-w-0 so it can shrink on small screens */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-white">
        {selectedLesson ? (
          <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            {/* Lesson Header */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 mb-2 break-words">
                    {selectedLesson.title}
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Lesson {currentIndex + 1} of {course.lessons?.length || 0}
                  </p>
                </div>
                <button
                  onClick={handleToggleComplete}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                    isLessonCompleted
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isLessonCompleted ? (
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

              {/* Course Progress */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                  <span>Course Progress</span>
                  <span className={`font-bold ${
                    lessonProgress.percentage === 100 ? 'text-green-600' : 'text-indigo-600'
                  }`}>
                    {lessonProgress.percentage}%
                  </span>
                </div>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      lessonProgress.percentage === 100 ? 'bg-green-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${lessonProgress.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Video Section */}
            {selectedLesson?.videoUrl && (
              <div className="mb-8">
                {user?.isAdmin && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={handleEditVideo}
                      className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium transition-colors"
                    >
                      Edit Video URL
                    </button>
                  </div>
                )}
                <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg max-w-full w-full">
                  {selectedLesson.videoUrl && selectedLesson.videoUrl.includes('loom.com/share/') ? (
                    // Loom share link - use embed
                    <div className="aspect-video w-full max-w-full">
                      <iframe
                        className="w-full h-full rounded-lg"
                        src={selectedLesson.videoUrl.replace('loom.com/share/', 'loom.com/embed/')}
                        title={selectedLesson.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : selectedLesson.videoUrl && (selectedLesson.videoUrl.includes('cdn.loom.com') || selectedLesson.videoUrl.includes('.mp4')) ? (
                    // Loom CDN video or direct MP4
                    <div className="aspect-video bg-black">
                      <video
                        className="w-full h-full"
                        controls
                        preload="metadata"
                        poster={selectedLesson.videoUrl.includes('thumbnails') ? selectedLesson.videoUrl : undefined}
                      >
                        <source src={selectedLesson.videoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ) : selectedLesson.videoUrl && (selectedLesson.videoUrl.includes('youtube.com') || selectedLesson.videoUrl.includes('youtu.be')) ? (
                    // YouTube video
                    <div className="aspect-video">
                      <iframe
                        className="w-full h-full rounded-lg"
                        src={
                          selectedLesson.videoUrl.includes('youtu.be/')
                            ? `https://www.youtube.com/embed/${selectedLesson.videoUrl.split('youtu.be/')[1].split('?')[0]}`
                            : selectedLesson.videoUrl.includes('watch?v=')
                            ? selectedLesson.videoUrl.replace('watch?v=', 'embed/').split('&')[0]
                            : selectedLesson.videoUrl.replace('youtu.be/', 'youtube.com/embed/')
                        }
                        title={selectedLesson.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : selectedLesson.videoUrl.includes('vimeo.com') ? (
                    // Vimeo video
                    <div className="aspect-video">
                      <iframe
                        className="w-full h-full"
                        src={`https://player.vimeo.com/video/${selectedLesson.videoUrl.split('/').pop()}`}
                        title={selectedLesson.title}
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    // Placeholder for other video types
                    <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                      <div className="text-center z-10">
                        <div className="mb-4">
                          <svg className="h-20 w-20 text-white/80 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                        <p className="text-white/90 font-medium text-lg mb-2">Video Lesson</p>
                        <p className="text-white/70 text-sm">Video player will be embedded here</p>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-24 w-24 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border-2 border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                          <svg className="h-12 w-12 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All lessons below video - jump to any lesson; collapsible by section */}
            {course?.lessons && course.lessons.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Lessons in this course
                </h2>
                {sectionGroups ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    {sectionGroups.map(({ section, lessons }) => {
                      const sectionLabel = section === '__none__' ? null : section
                      const isExpanded = sectionLabel ? expandedSections.has(sectionLabel) : true
                      return (
                        <div key={section} className="border-b border-gray-200 last:border-b-0">
                          {sectionLabel ? (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleSection(sectionLabel)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-800 bg-white hover:bg-gray-50 border-b border-gray-100"
                              >
                                <span>{sectionLabel}</span>
                                <svg
                                  className={`h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {isExpanded && (
                                <div className="bg-gray-50/80">
                                  {lessons.map((lesson) => {
                                    const isCompleted = courseProgress.lessonProgress[lesson.id] === true
                                    const isCurrent = selectedLessonId === lesson.id
                                    return (
                                      <button
                                        key={lesson.id}
                                        type="button"
                                        onClick={() => handleLessonClick(lesson.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                          isCurrent ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        {isCompleted ? (
                                          <span className="flex-shrink-0 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                                            <svg className="h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                          </span>
                                        ) : (
                                          <span className="flex-shrink-0 h-5 w-5 rounded-full border-2 border-gray-300" />
                                        )}
                                        <span className="flex-1 min-w-0 truncate">{lesson.title}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="bg-gray-50/80">
                              {lessons.map((lesson) => {
                                const isCompleted = courseProgress.lessonProgress[lesson.id] === true
                                const isCurrent = selectedLessonId === lesson.id
                                return (
                                  <button
                                    key={lesson.id}
                                    type="button"
                                    onClick={() => handleLessonClick(lesson.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                      isCurrent ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                                        <svg className="h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </span>
                                    ) : (
                                      <span className="flex-shrink-0 h-5 w-5 rounded-full border-2 border-gray-300" />
                                    )}
                                    <span className="flex-1 min-w-0 truncate">{lesson.title}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    {course.lessons.map((lesson) => {
                      const isCompleted = courseProgress.lessonProgress[lesson.id] === true
                      const isCurrent = selectedLessonId === lesson.id
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => handleLessonClick(lesson.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-b border-gray-100 last:border-b-0 ${
                            isCurrent ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {isCompleted ? (
                            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          ) : (
                            <span className="flex-shrink-0 h-5 w-5 rounded-full border-2 border-gray-300" />
                          )}
                          <span className="flex-1 min-w-0 truncate">{lesson.title}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Lesson Content */}
            <div className="prose max-w-none min-w-0">
              <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Lesson Content</h2>
                  {user?.isAdmin && (
                    <button
                      onClick={handleEditLesson}
                      className="flex-shrink-0 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium transition-colors"
                    >
                      Edit Lesson
                    </button>
                  )}
                </div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {selectedLesson.content}
                </p>
              </div>
            </div>

            {/* Resources Section - Visible to all users, upload only for admins */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Course Resources</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Documents and files for this course
                    {selectedLessonId && ' • ' + (course?.lessons.find(l => l.id === selectedLessonId)?.title || 'Current lesson')}
                  </p>
                </div>
                {user?.isAdmin && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow transition-all font-medium text-sm"
                  >
                    Upload Resource
                  </button>
                )}
              </div>

              {!Array.isArray(resources) || resources.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-500 mb-2">No resources available for this course yet.</p>
                  {user?.isAdmin && (
                    <p className="text-sm text-gray-400">Click "Upload Resource" to add documents.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(resources) && resources.map((resource) => {
                    const lesson = resource.lessonId
                      ? course?.lessons.find((l) => l.id === resource.lessonId)
                      : null

                    return (
                      <div
                        key={resource.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="text-2xl flex-shrink-0">
                            {getFileIcon(resource.fileType, resource.resourceType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {resource.title}
                            </h3>
                            {resource.description && (
                              <p className="text-sm text-gray-600 truncate mt-1">
                                {resource.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-3 mt-2">
                              {lesson && (
                                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                                  {lesson.title}
                                </span>
                              )}
                              {resource.resourceType === 'url' ? (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  🔗 URL
                                </span>
                              ) : (
                                <p className="text-xs text-gray-500">
                                  {resource.fileSize ? formatFileSize(resource.fileSize) : ''} {resource.fileSize && resource.fileType ? '•' : ''} {resource.fileType || ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {resource.resourceType === 'url' && resource.externalUrl ? (
                            <a
                              href={resource.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors flex-shrink-0"
                            >
                              Open Link
                            </a>
                          ) : resource.resourceType !== 'url' && resource.fileUrl ? (
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('token')
                                  const response = await fetch(`${getApiOrigin()}${resource.fileUrl}`, {
                                    headers: {
                                      'Authorization': `Bearer ${token}`,
                                    },
                                  })
                                  if (response.ok) {
                                    const blob = await response.blob()
                                    const url = window.URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = resource.fileName || 'download'
                                    document.body.appendChild(a)
                                    a.click()
                                    window.URL.revokeObjectURL(url)
                                    document.body.removeChild(a)
                                  } else {
                                    const error = await response.json()
                                    alert(error.error || 'Failed to download file')
                                  }
                                } catch (error) {
                                  console.error('Download error:', error)
                                  alert('Failed to download file')
                                }
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors flex-shrink-0"
                            >
                              Download
                            </button>
                          ) : null}
                          {user?.isAdmin && (
                            <button
                              onClick={() => handleDelete(resource.id)}
                              className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Edit Video Modal - Admin Only */}
            {showEditVideoModal && user?.isAdmin && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Edit Video URL</h2>
                    <button
                      onClick={() => setShowEditVideoModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={handleSaveVideo} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Video URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editVideoData.videoUrl}
                        onChange={(e) => setEditVideoData({ videoUrl: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex items-center justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowEditVideoModal(false)}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit Lesson Modal - Admin Only */}
            {showEditLessonModal && user?.isAdmin && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Edit Lesson</h2>
                    <button
                      onClick={() => setShowEditLessonModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={handleSaveLesson} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editLessonData.title}
                        onChange={(e) => setEditLessonData({ ...editLessonData, title: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Content
                      </label>
                      <textarea
                        value={editLessonData.content}
                        onChange={(e) => setEditLessonData({ ...editLessonData, content: e.target.value })}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Video URL
                      </label>
                      <input
                        type="text"
                        value={editLessonData.videoUrl}
                        onChange={(e) => setEditLessonData({ ...editLessonData, videoUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex items-center justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowEditLessonModal(false)}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Upload Modal - Admin Only */}
            {showUploadModal && user?.isAdmin && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Upload Resource</h2>
                    <button
                      onClick={() => setShowUploadModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resource Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={uploadData.resourceType}
                        onChange={(e) =>
                          setUploadData({ ...uploadData, resourceType: e.target.value as 'file' | 'url', file: null, externalUrl: '' })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="file">File Upload</option>
                        <option value="url">External URL</option>
                      </select>
                    </div>

                    {course && course.lessons && course.lessons.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Lesson (Optional)
                        </label>
                        <select
                          value={uploadData.lessonId}
                          onChange={(e) =>
                            setUploadData({ ...uploadData, lessonId: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">All lessons in this course</option>
                          {course.lessons && Array.isArray(course.lessons) && course.lessons.map((lesson) => (
                            <option key={lesson.id} value={lesson.id}>
                              {lesson.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={uploadData.title}
                        onChange={(e) =>
                          setUploadData({ ...uploadData, title: e.target.value })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Resource title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <textarea
                        value={uploadData.description}
                        onChange={(e) =>
                          setUploadData({ ...uploadData, description: e.target.value })
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Resource description"
                      />
                    </div>

                    {uploadData.resourceType === 'file' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          File <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="file"
                          onChange={handleFileSelect}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        {uploadData.file && (
                          <p className="mt-1 text-sm text-gray-600">
                            Selected: {uploadData.file.name}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          URL <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={uploadData.externalUrl}
                          onChange={(e) =>
                            setUploadData({ ...uploadData, externalUrl: e.target.value })
                          }
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="https://..."
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowUploadModal(false)}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                      >
                        Upload
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  {previousLesson ? (
                    <button
                      onClick={() => handleLessonClick(previousLesson.id)}
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
                    </button>
                  ) : (
                    <div className="text-gray-400 px-4 py-2 text-sm">No previous lesson</div>
                  )}
                </div>

                <div>
                  {nextLesson ? (
                    <button
                      onClick={() => handleLessonClick(nextLesson.id)}
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
                    </button>
                  ) : (
                    <div className="text-gray-400 px-4 py-2 text-sm">No next lesson</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a lesson to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default CourseDetail
