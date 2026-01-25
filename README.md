# Coding Exam Platform

A secure, scalable online coding exam platform supporting MCQ and coding assessments with automated evaluation, real-time session management, and comprehensive analytics.

## Features

### Authentication & Security
- JWT-based authentication with refresh tokens
- Role-based access control (Admin/Student)
- Single active session enforcement
- Rate limiting on sensitive endpoints
- Audit logging for compliance

### Exam Management (Admin)
- Create exams with MCQ and coding sections
- Configure time limits, marks, negative marking
- Bulk import questions (CSV/JSON)
- Exam lifecycle: Draft → Published → Active → Closed
- Immutability for active exams
- Clone exams for reuse

### Student Experience
- Dashboard with assigned exams
- Server-synchronized timer (cheat-proof)
- Auto-save responses every 30 seconds
- Session recovery on disconnect
- Mark questions for review
- Submit anytime or auto-submit on timeout

### Code Execution Engine
- Sandboxed Docker containers per language
- Supported: Python, Java, C++, JavaScript
- Resource limits (CPU, memory, time)
- Queue-based async processing
- Hidden test case evaluation

### Automated Evaluation
- Instant MCQ grading with answer keys
- Partial marking for coding problems
- Best submission selection
- Batch evaluation on exam close

### Analytics & Reporting
- Individual scorecards
- Ranking with percentiles
- Question difficulty analysis
- Export to CSV/PDF

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | Go |
| **Framework** | Gin |
| **Database** | PostgreSQL + GORM |
| **Cache** | Dragonfly (Redis-compatible) |
| **Queue** | Asynq |
| **Containers** | Docker |
| **Frontend** | React/Next.js (planned) |

---

## Project Structure

```
├── config/         # Configuration, database, cache setup
├── controllers/    # HTTP request handlers
├── middleware/     # Auth, RBAC, rate limiting
├── models/         # Database models (GORM)
├── routes/         # Route definitions
├── services/       # Business logic
├── utils/          # Helper functions
├── docker/         # Dockerfiles for code execution
└── main.go         # Entry point
```

---

## Quick Start

```bash
# 1. Install dependencies
go mod tidy

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Start services (PostgreSQL + Dragonfly)
docker-compose up -d

# 4. Run server
go run main.go

# 5. Test health
curl http://localhost:8080/health
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `8080` | No |
| `GIN_MODE` | Gin framework mode (`debug`/`release`) | `debug` | No |
| `DB_HOST` | PostgreSQL host | `localhost` | No |
| `DB_PORT` | PostgreSQL port | `5432` | No |
| `DB_USER` | Database user | `coding_user` | No |
| `DB_PASSWORD` | Database password | - | **Yes** |
| `DB_NAME` | Database name | `coding_platform` | No |
| `JWT_SECRET` | JWT signing key | - | **Yes** |
| `JUDGE0_URL` | Judge0 API endpoint | `http://localhost:2358` | No |

---

## API Overview

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| POST | `/api/v1/auth/register` | User registration |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/logout` | User logout |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/admin/exams` | Create exam |
| GET | `/api/v1/admin/exams` | List exams |
| POST | `/api/v1/admin/exams/:id/publish` | Publish exam |
| GET | `/api/v1/admin/exams/:id/analytics` | Exam analytics |

### Student
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/student/exams` | Assigned exams |
| POST | `/api/v1/student/exams/:id/start` | Start exam |
| POST | `/api/v1/student/sessions/:id/submit` | Submit exam |
| GET | `/api/v1/student/exams/:id/result` | View result |

---



