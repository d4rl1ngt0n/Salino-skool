import { useState } from 'react'

interface Event {
  id: string
  title: string
  date: string
  time: string
  description: string
}

const Calendar = () => {
  const [selectedDate] = useState(new Date())
  const [events] = useState<Event[]>([
    {
      id: '1',
      title: 'Weekly Community Meeting',
      date: '2024-01-28',
      time: '10:00 AM',
      description: 'Join us for our weekly community meeting to discuss progress and share insights.',
    },
    {
      id: '2',
      title: 'Course Workshop: Meta Ads',
      date: '2024-02-05',
      time: '2:00 PM',
      description: 'Deep dive workshop on Meta Ads strategies and best practices.',
    },
  ])

  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar</h1>
        <p className="text-gray-600">
          View upcoming events and schedule
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </h2>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const hasEvent = events.some(e => e.date === dateStr)
              
              return (
                <div
                  key={day}
                  className={`h-10 flex items-center justify-center rounded-lg transition-all text-sm ${
                    hasEvent
                      ? 'bg-indigo-100 text-indigo-700 font-semibold'
                      : 'hover:bg-gray-100 text-gray-700'
                  } cursor-pointer`}
                >
                  {day}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Events</h2>
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                <h3 className="font-semibold text-gray-900 text-sm">{event.title}</h3>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(event.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })} at {event.time}
                </p>
                <p className="text-xs text-gray-500 mt-2">{event.description}</p>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-sm text-gray-500">No upcoming events</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Calendar
