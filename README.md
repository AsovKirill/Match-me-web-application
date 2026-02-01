# 🫶 FRENDIT – Real-Time Social Matching App

Modern Tinder-style friendship & dating platform built with Go, React, PostgreSQL, and WebSockets.

## 🚀 Backend Setup (Go)

### ✅ 1. Clone the repository

```bash
git clone https://github.com/your/repo.git
cd web/backend-go
```

### ✅ 2. Create .env file

Inside backend-go/, create:

```sql
DATABASE_URL="postgres://YOUR_USER@localhost:5432/friendit?sslmode=disable"
JWT_SECRET="CHANGEME"
PORT=4000
FRONTEND_ORIGIN="http://localhost:5173"
```

Replace YOUR_USER with your local Postgres username
(On macOS usually the macOS username)

### ✅ 3. Create the database (one-time)

```bash
createdb friendit
```

(If Homebrew PG: brew services start postgresql@15)

### ✅ 4. Auto apply schema

No manual SQL required.

```
go run ./cmd/migrate
```

### ✅ 5. Auto-generate demo data

```bash
go run ./cmd/seed
```

Your Go seed script generates:

- 3 fixed demo users (Anna, Mark, Alex)
- 120 fake realistic users
- Full onboarding filled (bio, profile, location, hobbies, language)
- Auto photos
- Safe password for all: 1234567

### ✅ 6. Start backend API

```bash
go run .
```

## 🎨 Frontend Setup (React)

```bash
cd ../front
npm install
npm run dev
```
