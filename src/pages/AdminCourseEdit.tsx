import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useCourses } from '../context/CourseContext'
import { api } from '../services/api'

interface LessonRow {
  id: string
  title: string
  content: string
  video_url: string | null
  order_index: number
  section: string | null
}

const AdminCourseEdit = () => {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { courses, refreshCourses } = useCourses()
  const [course, setCourse] = useState<{ id: string; title: string; description?: string; lessons: LessonRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editCourse, setEditCourse] = useState({ title: '', description: '' })
  const [showLessonForm, setShowLessonForm] = useState(false)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [lessonForm, setLessonForm] = useState({
    title: '',
    content: '',
    video_url: '',
    order_index: 0,
    section: '',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    const c = courseId ? courses.find((x) => x.id === courseId) : undefined
    if (c) {
      setCourse({
        id: c.id,
        title: c.title,
        description: c.description,
        lessons: (c.lessons || []).map((l) => ({
          id: l.id,
          title: l.title,
          content: l.content ?? '',
          video_url: l.videoUrl ?? null,
          order_index: l.order,
          section: l.section ?? null,
        })),
      })
      setEditCourse({ title: c.title, description: c.description ?? '' })
    } else {
      setCourse(null)
    }
    setLoading(false)
  }, [courseId, courses])

  const refreshCourse = async () => {
    if (!courseId) return
    const res = await api.getCourse(courseId)
    if (res.data) {
      const c = res.data
      setCourse({
        id: c.id,
        title: c.title,
        description: c.description,
        lessons: (c.lessons || []).map((l: any) => ({
          id: l.id,
          title: l.title,
          content: l.content ?? '',
          video_url: l.video_url ?? null,
          order_index: l.order_index,
          section: l.section ?? null,
        })),
      })
      setEditCourse({ title: c.title, description: c.description ?? '' })
    }
  }

  const handleSaveCourse = async () => {
    if (!courseId || saving) return
    setSaving(true)
    setError(null)
    const res = await api.updateCourse(courseId, {
      title: editCourse.title || undefined,
      description: editCourse.description || undefined,
    })
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    if (res.data) {
      setCourse((prev) =>
        prev ? { ...prev, title: res.data!.title, description: res.data!.description } : null
      )
    }
  }

  const openAddLesson = () => {
    const nextOrder = course?.lessons.length ? Math.max(...course.lessons.map((l) => l.order_index), 0) + 1 : 1
    setLessonForm({
      title: '',
      content: '',
      video_url: '',
      order_index: nextOrder,
      section: '',
    })
    setEditingLessonId(null)
    setShowLessonForm(true)
  }

  const openEditLesson = (lesson: LessonRow) => {
    setLessonForm({
      title: lesson.title,
      content: lesson.content,
      video_url: lesson.video_url ?? '',
      order_index: lesson.order_index,
      section: lesson.section ?? '',
    })
    setEditingLessonId(lesson.id)
    setShowLessonForm(true)
  }

  const handleSaveLesson = async () => {
    if (!courseId || saving) return
    if (!lessonForm.title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError(null)
    if (editingLessonId) {
      const res = await api.updateLesson(courseId, editingLessonId, {
        title: lessonForm.title.trim(),
        content: lessonForm.content,
        videoUrl: lessonForm.video_url || undefined,
        order_index: Number(lessonForm.order_index) || 0,
        section: lessonForm.section.trim() || null,
      })
      setSaving(false)
      if (res.error) {
        setError(res.error)
        return
      }
    } else {
      const res = await api.createLesson(courseId, {
        title: lessonForm.title.trim(),
        content: lessonForm.content,
        video_url: lessonForm.video_url || null,
        order_index: Number(lessonForm.order_index) || 0,
        section: lessonForm.section.trim() || null,
      })
      setSaving(false)
      if (res.error) {
        setError(res.error)
        return
      }
    }
    setShowLessonForm(false)
    refreshCourse()
    refreshCourses()
  }

  const handleDeleteLesson = async (lessonId: string) => {
    if (!courseId || saving) return
    setSaving(true)
    setError(null)
    const res = await api.deleteLesson(courseId, lessonId)
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setDeleteConfirm(null)
    refreshCourse()
    refreshCourses()
  }

  const moveLesson = async (lessonId: string, direction: 'up' | 'down') => {
    if (!course) return
    const sorted = [...course.lessons].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex((l) => l.id === lessonId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[swapIdx]
    setSaving(true)
    setError(null)
    await api.updateLesson(courseId!, a.id, { order_index: b.order_index })
    const resB = await api.updateLesson(courseId!, b.id, { order_index: a.order_index })
    setSaving(false)
    if (resB.error) setError(resB.error)
    else {
      refreshCourse()
      refreshCourses()
    }
  }

  if (loading || !course) {
    return (
      <div className="max-w-4xl mx-auto">
        {!course && !loading && (
          <p className="text-gray-600">Course not found.</p>
        )}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        )}
      </div>
    )
  }

  const sortedLessons = [...course.lessons].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <Link to="/admin/courses" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Back to courses
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">Edit course</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white">
        <label className="block text-sm font-medium text-gray-700 mb-1">Course title</label>
        <input
          type="text"
          value={editCourse.title}
          onChange={(e) => setEditCourse((p) => ({ ...p, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
        />
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={editCourse.description}
          onChange={(e) => setEditCourse((p) => ({ ...p, description: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
        />
        <button
          type="button"
          onClick={handleSaveCourse}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save course'}
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Lessons</h2>
        <button
          type="button"
          onClick={openAddLesson}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          Add lesson
        </button>
      </div>

      <ul className="space-y-2 mb-8">
        {sortedLessons.map((lesson, index) => (
          <li
            key={lesson.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-white"
          >
            <span className="text-gray-400 text-sm w-8">{lesson.order_index}</span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-900 block truncate">{lesson.title}</span>
              {lesson.section && (
                <span className="text-xs text-gray-500">{lesson.section}</span>
              )}
              {lesson.video_url && (
                <span className="text-xs text-gray-400 truncate block">
                  {lesson.video_url.replace(/^https?:\/\//, '').slice(0, 50)}…
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => moveLesson(lesson.id, 'up')}
                disabled={saving || index === 0}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-40"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveLesson(lesson.id, 'down')}
                disabled={saving || index === sortedLessons.length - 1}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-40"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => openEditLesson(lesson)}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                title="Edit"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(lesson.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                title="Delete"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showLessonForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingLessonId ? 'Edit lesson' : 'Add lesson'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={lessonForm.content}
                  onChange={(e) => setLessonForm((p) => ({ ...p, content: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                <input
                  type="url"
                  value={lessonForm.video_url}
                  onChange={(e) => setLessonForm((p) => ({ ...p, video_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section (optional)</label>
                <input
                  type="text"
                  value={lessonForm.section}
                  onChange={(e) => setLessonForm((p) => ({ ...p, section: e.target.value }))}
                  placeholder="e.g. Intro, Search Ads"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <input
                  type="number"
                  min={1}
                  value={lessonForm.order_index}
                  onChange={(e) =>
                    setLessonForm((p) => ({ ...p, order_index: parseInt(e.target.value, 10) || 0 }))
                  }
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowLessonForm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLesson}
                disabled={saving || !lessonForm.title.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingLessonId ? 'Save' : 'Add lesson'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <p className="text-gray-800 mb-4">Delete this lesson? Progress and resources linked to it may be affected.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLesson(deleteConfirm)}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminCourseEdit
