# Salino GmbH Backend Server

Backend API server for Salino GmbH platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login user

### Courses
- `GET /api/courses` - Get all courses
- `GET /api/courses/:courseId` - Get single course
- `GET /api/courses/:courseId/lessons/:lessonId` - Get lesson
- `GET /api/courses/:courseId/progress` - Get user progress for course (requires auth)
- `POST /api/courses/:courseId/lessons/:lessonId/progress` - Update lesson progress (requires auth)
- `GET /api/courses/progress/all` - Get all user progress (requires auth)

### Users
- `GET /api/users/me` - Get current user profile (requires auth)

## Database

Uses SQLite database stored in `data/salino.db`

## Default Test Account

A default test account is automatically created when the database is initialized:

- **Email:** `test@salino.com`
- **Password:** `test123`
- **Name:** Test User

You can use these credentials to log in immediately after starting the server for the first time.
