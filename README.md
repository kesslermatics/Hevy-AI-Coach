# 🏋️ HevyCoach-AI

A full-stack smart wrapper for the Hevy Workout Tracker API. Built with React (Frontend) and FastAPI (Backend). It acts as an intelligent gym companion, fetching workout histories via Hevy's official API, managing multi-user authentication locally, and providing AI-driven progressive overload recommendations.

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL + SQLAlchemy
- **Authentication**: JWT tokens + bcrypt password hashing

## 📁 Project Structure

```
HevyCoach-AI/
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── auth.py       # Registration & login endpoints
│   │   │   └── user.py       # User profile & API key management
│   │   ├── config.py         # Environment configuration
│   │   ├── database.py       # SQLAlchemy setup
│   │   ├── dependencies.py   # Auth dependencies
│   │   ├── models.py         # Database models
│   │   ├── schemas.py        # Pydantic schemas
│   │   └── security.py       # Password hashing & JWT
│   ├── main.py               # FastAPI application
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── api.ts        # API communication utility
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── main.tsx
│   ├── package.json
│   └── .env.example
└── .gitignore
```

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL database

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   
   # Windows
   .\venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   # Copy the example env file
   cp .env.example .env
   
   # Edit .env with your settings:
   # - DATABASE_URL: Your PostgreSQL connection string
   # - JWT_SECRET_KEY: Generate a secure random key
   ```

   **Generate a secure JWT secret key:**
   ```python
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

5. **Set up PostgreSQL database:**
   ```sql
   CREATE DATABASE hevycoach;
   ```

6. **Run the backend server:**
   ```bash
   uvicorn main:app --reload
   ```

   The API will be available at `http://localhost:8000`
   
   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   # Copy the example env file
   cp .env.example .env
   
   # Edit .env if needed (default API URL is http://localhost:8000)
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

## 🔐 Security Notes

⚠️ **IMPORTANT**: This is a PUBLIC repository. Never commit sensitive data!

- All secrets are loaded from environment variables
- `.env` files are in `.gitignore` - never tracked
- Passwords are hashed using bcrypt
- JWT tokens are used for stateless authentication
- Always generate a strong `JWT_SECRET_KEY` for production

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and get JWT token |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user/me` | Get current user info |
| POST | `/user/api-key` | Save Hevy API key |
| DELETE | `/user/api-key` | Remove Hevy API key |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Basic health check |
| GET | `/health` | Detailed health status |

## 🗺️ Roadmap

- [x] User authentication (register/login)
- [x] Secure API key storage
- [ ] Hevy API integration
- [ ] Workout data sync
- [ ] AI coaching recommendations
- [ ] Progress tracking & visualization

## 📄 License

MIT License - feel free to use this project for learning and development!
