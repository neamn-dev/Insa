# 🔐 Production-Grade Authentication & Identity System

A complete, security-first authentication and identity management system built with **Flask** (Python) and vanilla **HTML/CSS/JS**. Designed to meet enterprise-grade security requirements for user registration, session management, OAuth integration, and brute-force protection.

---

## 📋 Table of Contents

- [Security Requirements & Implementation](#-security-requirements--implementation)
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Reference](#-api-reference)
- [Authentication Flow](#-authentication-flow)
- [Security Controls Deep Dive](#-security-controls-deep-dive)
- [Configuration](#-configuration)
- [Frontend Pages](#-frontend-pages)

---

## 🛡️ Security Requirements & Implementation

| # | Security Requirement | Status | Implementation |
|---|----------------------|--------|----------------|
| 1 | **Users must not be able to use weak passwords** | ✅ Implemented | Password strength validation enforces minimum 8 characters, at least one letter, and at least one digit. Rejected at both registration and password change flows. |
| 2 | **The system must prevent brute-force login attacks** | ✅ Implemented | Progressive account lockout after **5 consecutive failed attempts**. Account is locked for **5 minutes** (300 seconds). Failed attempts are tracked per-user in SQLite with automatic reset on successful login. |
| 3 | **Users should stay logged in without keeping long-lived access tokens** | ✅ Implemented | Dual-token architecture: short-lived **JWT access tokens** (5 min) stored in `sessionStorage`, paired with long-lived **refresh tokens** (7 days) stored as `HttpOnly` cookies. Silent token rotation keeps users logged in without exposing long-lived credentials. |
| 4 | **Users should be able to sign in using Google** | ✅ Implemented | Full **Google OAuth 2.0** redirect flow (Authorization Code Grant). Firebase authentication is also supported as an alternative. |
| 5 | **The system must detect suspicious login activities** | ✅ Implemented | **User-Agent fingerprint comparison** on every login. If the incoming browser/device differs from the last known device, the login is flagged as suspicious and the user is alerted on the dashboard. Full **login history audit trail** is recorded in the database. |
| 6 | **Users should be able to view and manage their active sessions** | ✅ Implemented | Dedicated **Sessions page** showing all active sessions with device info, IP address, and timestamps. Users can **revoke individual sessions** or **revoke all other sessions** while keeping their current session active. |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (HTML/JS)                   │
│  login.html │ register.html │ dashboard.html │ sessions  │
└──────────────────────┬──────────────────────────────────┘
                       │  REST API (JSON)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 Flask Backend (Python)                    │
│                                                          │
│  app.py ─── Routes & Middleware                          │
│    ├── /api/register     (POST)                          │
│    ├── /api/login        (POST)                          │
│    ├── /api/refresh      (POST)                          │
│    ├── /api/logout       (POST)                          │
│    ├── /api/me           (GET/PUT)                       │
│    ├── /api/sessions     (GET)                           │
│    ├── /api/sessions/revoke (POST)                       │
│    ├── /api/login-history   (GET)                        │
│    ├── /api/change-password (POST)                       │
│    ├── /api/google/redirect (GET)                        │
│    ├── /api/google/callback (GET)                        │
│    └── /api/firebase-login  (POST)                       │
│                                                          │
│  auth.py ─── Core Authentication Logic                   │
│    ├── Password hashing (Werkzeug/PBKDF2)                │
│    ├── JWT token generation & verification               │
│    ├── Session lifecycle management                      │
│    ├── Brute-force lockout engine                        │
│    ├── Suspicious device detection                       │
│    └── Login audit trail                                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              SQLite Database (neamndb.db)                 │
│                                                          │
│  Tables:                                                 │
│    ├── users          (accounts, credentials, lockout)    │
│    ├── sessions       (active sessions, device tracking)  │
│    └── login_attempts (audit log, risk flags)            │
└─────────────────────────────────────────────────────────┘
```

---

## 🧰 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Python 3 + Flask | REST API server |
| **Database** | SQLite | Persistent storage (zero-config) |
| **Auth Tokens** | PyJWT (HS256) | Access & refresh token generation |
| **Password Hashing** | Werkzeug (PBKDF2-SHA256) | Secure credential storage |
| **OAuth** | Google OAuth 2.0 | Social sign-in |
| **Firebase** | Firebase Admin SDK | Alternative social auth |
| **Frontend** | HTML5 + CSS3 + Vanilla JS | User interface |
| **Security** | Flask-CORS, Helmet-style headers | XSS/CSRF/Clickjacking protection |

---

## 📁 Project Structure

```
challenge 2/
├── .env                          # Environment variables (OAuth keys, secrets)
├── README.md                     # This file
├── SECURITY.md                   # Detailed security controls documentation
│
├── backend/                      # Flask backend
│   ├── app.py                    # Main Flask application & API routes
│   ├── auth.py                   # Core authentication module
│   ├── requirements.txt          # Python dependencies
│   └── database/
│       └── neamndb.db            # SQLite database (auto-created)
│
├── frontend/                     # Frontend pages
│   ├── login.html                # Login page
│   ├── register.html             # Registration page
│   ├── dashboard.html            # User dashboard (protected)
│   ├── sessions.html             # Active sessions manager
│   ├── style.css                 # Global styles
│   ├── script.js                 # Shared frontend logic
│   ├── firebase-config.js        # Firebase client configuration
│   └── firebase-config.example.js# Firebase config template
│
├── index.html                    # Root landing page
└── style.css                     # Root styles
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** installed
- **pip** package manager

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "challenge 2"
```

### 2. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create or edit the `.env` file in the project root:

```env
# Required
PORT=5000

# Google OAuth 2.0 (Optional — system works in Demo Mode without these)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:5000/api/google/callback
```

> **Note**: If `GOOGLE_CLIENT_ID` is not configured, the Google Sign-In button will use **Demo Mode** — it automatically creates a test Google user in SQLite without requiring real Google credentials.

### 4. Run the Server

```bash
cd backend
flask run
```

Or alternatively:

```bash
cd backend
python app.py
```

### 5. Open the Application

Navigate to: **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

You will be redirected to the login page. From there you can:
- **Register** a new account
- **Login** with email/password
- **Sign in with Google** (OAuth or Demo Mode)

---

## 📡 API Reference

All endpoints return JSON responses with the following structure:

```json
{
  "status": "success" | "fail" | "error",
  "message": "Human-readable message",
  ...
}
```

### Authentication Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/api/register` | ❌ | Create a new user account |
| `POST` | `/api/login` | ❌ | Authenticate with email & password |
| `POST` | `/api/refresh` | 🍪 Refresh Cookie | Exchange refresh token for new access token |
| `POST` | `/api/logout` | 🍪 Refresh Cookie | Revoke current session and clear cookies |

### Google OAuth Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `GET` | `/api/google/redirect` | ❌ | Redirect to Google consent screen |
| `GET` | `/api/google/callback` | ❌ | Handle Google OAuth callback |
| `POST` | `/api/firebase-login` | ❌ | Authenticate via Firebase ID token |

### Protected Endpoints (Require `Authorization: Bearer <access_token>`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me` | Get current user profile |
| `PUT` | `/api/me` | Update user profile (name) |
| `POST` | `/api/change-password` | Change password |
| `GET` | `/api/sessions` | List all active sessions |
| `POST` | `/api/sessions/revoke` | Revoke a specific session or all other sessions |
| `GET` | `/api/login-history` | Get login attempt audit trail (last 20) |

### Example: Register a User

```bash
curl -X POST http://127.0.0.1:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Account registered successfully! You can now log in.",
  "user": {
    "id": "uuid-here",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Example: Login

```bash
curl -X POST http://127.0.0.1:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Login successful",
  "access_token": "eyJhbGciOi...",
  "suspicious_login": false,
  "user": {
    "id": "uuid-here",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

> The response also sets a `refresh_token` as an `HttpOnly` cookie.

---

## 🔄 Authentication Flow

### Registration Flow
```
User ──► POST /api/register
           │
           ├── Validate: name, email, password required
           ├── Password strength check (8+ chars, letter, digit)
           ├── Check for duplicate email
           ├── Hash password (PBKDF2-SHA256)
           ├── Create user in SQLite
           └── Return success ✅
```

### Login Flow
```
User ──► POST /api/login
           │
           ├── Check brute-force lockout (5 attempts → 5 min lock)
           ├── Verify email + password hash
           ├── On failure: increment counter, check lockout
           ├── On success: reset counter
           ├── Suspicious device check (User-Agent comparison)
           ├── Create session record in DB
           ├── Generate access token (5 min) + refresh token (7 days)
           ├── Set refresh token as HttpOnly cookie
           └── Return access token + suspicious flag ✅
```

### Token Refresh Flow (Silent Re-Authentication)
```
Browser ──► POST /api/refresh (cookie: refresh_token)
              │
              ├── Verify refresh JWT signature + expiration
              ├── Check session is still active in DB
              ├── Generate new access token + new refresh token
              ├── Set rotated refresh token as HttpOnly cookie
              └── Return new access token ✅
```

### Google OAuth Flow
```
User clicks "Sign in with Google"
  │
  ├── GET /api/google/redirect
  │     └── Redirect to Google consent screen
  │
  ├── User authenticates with Google
  │
  ├── GET /api/google/callback?code=AUTH_CODE
  │     ├── Exchange code for tokens with Google
  │     ├── Decode ID token → extract email, name
  │     ├── Create or find user in SQLite
  │     ├── Create session, generate tokens
  │     ├── Set cookies (access + refresh)
  │     └── Redirect to /dashboard.html ✅
  │
  └── (If no Google credentials configured → Demo Mode)
        └── Auto-create test user → redirect to dashboard ✅
```

---

## 🔒 Security Controls Deep Dive

### 1. Password Policy Enforcement
- **Minimum length**: 8 characters
- **Required composition**: At least one letter (a-z/A-Z) + at least one digit (0-9)
- **Enforced at**: Registration (`/api/register`) and password change (`/api/change-password`)
- **Implementation**: [`auth.py → validate_password_strength()`](backend/auth.py)

### 2. Brute-Force Protection
- **Threshold**: 5 consecutive failed login attempts
- **Lockout duration**: 300 seconds (5 minutes)
- **Scope**: Per-user (tracked via `failed_attempts` and `lockout_until` columns)
- **Reset**: Counter resets to 0 on successful login
- **Response**: HTTP 429 with remaining lockout time

### 3. Dual-Token Session Architecture
| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| **Access Token** | 5 minutes | `sessionStorage` (JS) | Authorize API requests via `Authorization: Bearer` header |
| **Refresh Token** | 7 days | `HttpOnly` cookie | Silently obtain new access tokens without re-login |

- Access tokens are **never** stored in cookies (prevents CSRF)
- Refresh tokens are **never** accessible to JavaScript (prevents XSS theft)
- Refresh tokens are **rotated** on every refresh call

### 4. Google OAuth 2.0 Integration
- Uses the **Authorization Code Grant** flow (most secure OAuth flow)
- Server-side token exchange (client secret never exposed to browser)
- Automatic user provisioning on first Google sign-in
- **Demo Mode** fallback for development without Google Cloud credentials

### 5. Suspicious Login Detection
- Compares incoming `User-Agent` header against the last known device
- If mismatch detected → login is flagged as `suspicious_login: true`
- Dashboard displays a security alert to the user
- All login attempts are recorded in the `login_attempts` audit table with timestamps, IP addresses, and risk flags

### 6. Session Management
- Each login creates a unique session record in SQLite
- Sessions page shows: device info, IP address, creation time, last activity
- Current session is highlighted and cannot be self-revoked
- Users can revoke individual sessions or all other sessions at once
- Revoked sessions immediately invalidate their associated tokens

### 7. HTTP Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## ⚙️ Configuration

### Environment Variables (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | Optional | — | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | — | Google OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | Optional | `http://127.0.0.1:5000/api/google/callback` | OAuth callback URL |

### Internal Constants ([`auth.py`](backend/auth.py))

| Constant | Value | Description |
|----------|-------|-------------|
| `SECRET_KEY` | `demo-flask-auth-secret-key-...` | JWT signing key (⚠️ change in production) |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRES_MINUTES` | `5` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_DAYS` | `7` | Refresh token lifetime |
| `MAX_FAILED_ATTEMPTS` | `5` | Login attempts before lockout |
| `LOCKOUT_TIME_SECONDS` | `300` | Lockout duration (5 minutes) |

---

## 🖥️ Frontend Pages

| Page | URL | Description |
|------|-----|-------------|
| **Login** | `/login.html` | Email/password login + Google Sign-In button |
| **Register** | `/register.html` | New account registration with password validation |
| **Dashboard** | `/dashboard.html` | Protected user dashboard with profile info, suspicious login alerts |
| **Sessions** | `/sessions.html` | View and manage active sessions across devices |

---

## 📄 License

This project is developed as part of an authentication system challenge. All rights reserved.
