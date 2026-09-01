# Tawjihi Time - API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Authentication Endpoints

### Admin Login
```
POST /auth/admin/login
Content-Type: application/json

Request:
{
  "email": "ahmad169qyp12q@gmail.com",
  "password": "169qyp12q@"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "ahmad169qyp12q@gmail.com",
    "role": "super_admin"
  }
}

Response (401):
{
  "error": {
    "status": 401,
    "message": "Invalid credentials"
  }
}
```

### Google OAuth Callback
```
POST /auth/google/callback
Content-Type: application/json

Request:
{
  "tokenId": "...",
  "googleData": {
    "id": "123456789",
    "name": "Student Name",
    "email": "student@gmail.com",
    "picture": "https://..."
  }
}

Response (200):
{
  "success": true,
  "firstTime": false,
  "token": "eyJhbGc...",
  "user": {
    "id": 2,
    "email": "student@gmail.com",
    "role": "student"
  }
}

Response (200 - First Time):
{
  "success": true,
  "firstTime": true,
  "user": {
    "id": 2,
    "email": "student@gmail.com",
    "name": "Student Name",
    "role": "student"
  }
}
```

### Complete Student Profile
```
POST /auth/complete-profile
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "gradeId": 1,
  "subjects": [1, 2, 3]
}

Response (200):
{
  "success": true,
  "message": "Profile completed"
}

Response (400):
{
  "error": {
    "status": 400,
    "message": "Grade is required"
  }
}
```

### Get Current User
```
GET /auth/me
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "user": {
    "id": 1,
    "name": "Super Admin",
    "email": "ahmad169qyp12q@gmail.com",
    "profile_picture": null,
    "role": "super_admin",
    "grade_id": null,
    "account_status": "active",
    "created_at": "2026-08-29T...",
    "last_login_at": "2026-08-29T..."
  }
}
```

### Logout
```
POST /auth/logout
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "status": 401,
    "message": "Descriptive error message"
  }
}
```

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

## Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": {...}
}
```

Or for single resources:

```json
{
  "success": true,
  "user": {...}
}
```

## Pagination

Endpoints that support pagination include:
- `page` - Page number (default: 1)
- `perPage` - Results per page (default: 20, max: 100)

Response includes pagination metadata:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Roles and Permissions

### Roles
- `student` - Regular student user
- `admin` - Administrator with specific permissions
- `super_admin` - Full access to all features

### Permissions
- `manage_students` - Add, edit, delete students
- `view_students` - View student list and profiles
- `manage_subjects` - Create/edit subjects
- `manage_units` - Create/edit course units
- `manage_lessons` - Create/edit lessons
- `manage_sections` - Create/edit sections (CMS)
- `manage_exams` - Create/edit exams
- `manage_questions` - Create/edit exam questions
- `view_results` - View exam results
- `manage_notes` - Reply to student notes
- `reply_to_students` - Send messages to students
- `manage_messages` - Manage all messages
- `manage_announcements` - Create announcements
- `manage_files` - Upload and manage files
- `manage_settings` - Change platform settings
- `manage_admins` - Promote/demote admins (super_admin only)

## Database Schema

### Main Tables

#### users
- `id` - Primary key
- `name` - User name
- `email` - Email address (unique)
- `google_id` - Google OAuth ID
- `profile_picture` - Profile picture URL
- `role` - user_role enum (student, admin, super_admin)
- `password_hash` - Hashed password for admin users
- `grade_id` - Associated grade (FK)
- `account_status` - Status enum
- `created_at` - Registration timestamp
- `updated_at` - Last update timestamp
- `last_login_at` - Last login timestamp

#### grades
- `id` - Primary key
- `name` - Grade name (e.g., "First Secondary")
- `description` - Description
- `display_order` - Sort order
- `active` - Whether grade is active

#### subjects
- `id` - Primary key
- `name` - Subject name
- `description` - Subject description
- `grade_id` - Associated grade (FK)
- `display_order` - Sort order
- `visibility` - Whether visible to students
- `created_by` - User who created (FK)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `deleted_at` - Soft delete timestamp

#### units
- `id` - Primary key
- `subject_id` - Associated subject (FK)
- `name` - Unit name
- `description` - Unit description
- `display_order` - Sort order
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `deleted_at` - Soft delete timestamp

#### lessons
- `id` - Primary key
- `unit_id` - Associated unit (FK)
- `name` - Lesson name
- `description` - Lesson description
- `display_order` - Sort order
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `deleted_at` - Soft delete timestamp

#### sections
- `id` - Primary key
- `lesson_id` - Associated lesson (FK)
- `section_type` - Type enum (text, video, file, etc.)
- `title` - Section title
- `content` - Section content
- `display_order` - Sort order
- `visibility` - Whether visible
- `created_by` - User who created (FK)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `deleted_at` - Soft delete timestamp

#### exams
- `id` - Primary key
- `title` - Exam title
- `description` - Exam description
- `grade_id` - Target grade (FK)
- `subject_id` - Associated subject (FK)
- `unit_id` - Associated unit (optional FK)
- `lesson_id` - Associated lesson (optional FK)
- `duration_minutes` - Time limit
- `total_marks` - Total marks
- `passing_mark` - Passing score
- `visibility` - Whether visible to students
- `allow_multiple_attempts` - Allow retakes
- `max_attempts` - Maximum attempts allowed
- `show_results_immediately` - Show results after submission
- `created_by` - User who created (FK)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `deleted_at` - Soft delete timestamp

#### questions
- `id` - Primary key
- `exam_id` - Associated exam (FK, cascade delete)
- `question_text` - Question text
- `marks` - Question marks
- `display_order` - Sort order

#### answers
- `id` - Primary key
- `question_id` - Associated question (FK, cascade delete)
- `answer_text` - Answer text
- `is_correct` - Whether this is correct answer
- `display_order` - Sort order

#### exam_attempts
- `id` - Primary key
- `student_id` - Student (FK)
- `exam_id` - Exam (FK)
- `started_at` - When exam started
- `submitted_at` - When exam submitted
- `status` - Status (in_progress, submitted, etc.)

#### exam_results
- `id` - Primary key
- `attempt_id` - Exam attempt (FK)
- `student_id` - Student (FK)
- `exam_id` - Exam (FK)
- `score` - Points earned
- `total_marks` - Total possible marks
- `percentage` - Percentage score
- `passed` - Whether passed

#### student_notes
- `id` - Primary key
- `student_id` - Student (FK)
- `subject_id` - Subject (optional FK)
- `unit_id` - Unit (optional FK)
- `lesson_id` - Lesson (optional FK)
- `note` - Note content
- `is_read` - Whether admin has read
- `admin_reply` - Reply text
- `replied_by` - Admin who replied (FK)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `read_at` - When admin read
- `replied_at` - When admin replied

#### messages
- `id` - Primary key
- `sender_id` - Sender user (FK)
- `conversation_id` - Conversation ID
- `message` - Message text
- `is_read` - Whether read
- `created_at` - Creation timestamp

#### announcements
- `id` - Primary key
- `title` - Announcement title
- `content` - Announcement content
- `target_grade_id` - Target grade (optional FK)
- `created_by` - Creator (FK)
- `visibility` - Whether visible
- `publish_at` - Publication date
- `expires_at` - Expiration date (optional)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

#### notifications
- `id` - Primary key
- `recipient_id` - Recipient user (FK)
- `type` - Type enum
- `title` - Notification title
- `message` - Notification message
- `related_entity_type` - Entity type (optional)
- `related_entity_id` - Entity ID (optional)
- `is_read` - Whether read
- `created_at` - Creation timestamp
- `read_at` - When read (optional)

#### admin_permissions
- `id` - Primary key
- `admin_id` - Admin user (FK)
- `permission_name` - Permission name
- `is_granted` - Whether granted
- `granted_by` - Who granted (FK)
- `created_at` - When granted

#### audit_logs
- `id` - Primary key
- `actor_id` - User performing action (FK)
- `action` - Action type (string)
- `entity_type` - Entity type (string)
- `entity_id` - Entity ID (integer)
- `metadata` - Additional data (JSONB)
- `created_at` - When action occurred

---

**Last Updated**: August 2026
