// Course structure matching Skool platform
// This file contains the exact course and lesson structure
// Update this file with the correct structure from Skool, then run the database reset

export interface LessonData {
  id: string
  title: string
  content: string
  order: number
  videoUrl?: string
}

export interface CourseData {
  id: string
  title: string
  description: string
  order: number
  lessons: LessonData[]
}

export const courseStructure: CourseData[] = [
  {
    id: '1',
    title: '01: Intro & Onboarding (Start here)',
    description: 'Salino GmbH - SOP Library',
    order: 1,
    lessons: [
      {
        id: '1-1',
        title: 'Willkommen & Next Steps',
        content: 'Welcome to Salino GmbH. In this lesson, you will learn about the onboarding process and next steps to get started.',
        order: 1,
      },
      {
        id: '1-2',
        title: 'Zugänge',
        content: 'Learn about accessing the platform and all available resources.',
        order: 2,
      },
      {
        id: '1-3',
        title: 'Status Quo & Strategy Call',
        content: 'In this lesson, we will discuss your current situation and develop a strategic plan moving forward. This is an important step to understand where you are and where you want to go.',
        order: 3,
      },
      {
        id: '1-4',
        title: 'Expectations & Zusammenarbeit',
        content: 'Understanding expectations and how we will work together effectively.',
        order: 4,
      },
    ],
  },
  // TODO: Add remaining 14 courses with exact structure from Skool
  // The structure should match exactly what's on https://www.skool.com/ironmedia/classroom
]
