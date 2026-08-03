# SyncWrite — Real-Time Collaborative Document Editor

SyncWrite is a production-grade, real-time collaborative document editing platform built for businesses and educational institutions. It seamlessly integrates and extends the secure identity foundation built in Challenge 2 with modern real-time CRDT document synchronization (Yjs + ProseMirror + TipTap), role-based document access controls (Viewer, Commenter, Editor, Owner), auto-saving persistence, audit-preserving version history, and interactive presence awareness.

---

## 1. Project Context & Challenge 2 Integration

SyncWrite refactors and incorporates all core security mechanisms established in Challenge 2:
- **User Registration & Validation**: Password strength enforcement (min 8 characters, at least 1 letter and 1 number).
- **Secure Password Hashing**: Hashed using Werkzeug `scrypt`/`pbkdf2` algorithms.
- **JWT Access & Refresh Rotation**: Short-lived JWT access tokens paired with long-lived rotated refresh tokens stored securely in HTTP-only cookies.
- **Brute-Force Lockout Protection**: 5 consecutive failed login attempts trigger an immediate progressive 5-minute lockout (`HTTP 429 Too Many Requests`).
- **Suspicious Device Login Detection**: Tracks User-Agent variations to flag unexpected login locations/devices.
- **Audit History Logging**: Captures every login attempt (`login_attempts`) with IP address, User-Agent, and risk flags.
- **Active Session Management & Revocation**: Real-time listing of active sessions with remote revocation capability.
- **Google OAuth 2.0 Integration**: Direct authorization redirect flow with seamless demo fallback.

---

## 2. Technology Stack

- **Backend**: Python 3.14, Flask, Flask-SocketIO, SQLAlchemy ORM, Flask-Migrate, PostgreSQL (`psycopg2-binary`), PyJWT, Werkzeug.
- **Real-Time Communication**: Socket.IO, Flask-SocketIO rooms (`document:{document_id}`).
- **CRDT Synchronization**: Yjs, `y-prosemirror`, TipTap Editor (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-collaboration`).
- **Database**: PostgreSQL (`postgresql://postgres:postgres@localhost:5432/syncwrite`).
- **Frontend**: React 18, Vite 6, Tailwind CSS, Lucide Icons, React Router DOM v6, Axios.

---

## 3. Database Schema (PostgreSQL)

SyncWrite relies **exclusively on PostgreSQL**. The database schema contains 9 key entities:

### `users`
- `id` (UUID PK): Unique user ID
- `email` (String Unique): User email address
- `name` (String): Display name
- `password_hash` (String): Hashed password
- `avatar_url` (String): Optional user avatar URL
- `is_google` (Boolean): Flag for Google OAuth users
- `failed_attempts` (Integer): Brute-force failure counter
- `lockout_until` (BigInteger): Timestamp when lockout expires
- `last_user_agent` (String): Last seen User-Agent for device tracking
- `created_at` / `updated_at` (DateTime)

### `sessions`
- `id` (UUID PK): Session identifier
- `user_id` (UUID FK -> users.id): Associated user
- `refresh_token_hash` (String): Hash of issued refresh token
- `user_agent` (String): Client device string
- `ip_address` (String): Client IP
- `created_at` / `last_active` / `expires_at` (DateTime)
- `is_active` (Boolean): Active status flag for session revocation

### `login_attempts`
- `id` (UUID PK)
- `user_id` (UUID FK -> users.id, nullable)
- `email_attempted` (String)
- `ip_address` (String)
- `user_agent` (String)
- `success` (Boolean)
- `risk_flags` (Text/JSON): Audited security flags e.g. lockout triggered
- `created_at` (DateTime)

### `documents`
- `id` (UUID PK): Document identifier
- `title` (String): Document title
- `owner_id` (UUID FK -> users.id): Document owner
- `created_at` / `updated_at` / `last_opened_at` (DateTime)

### `document_shares`
- `id` (UUID PK)
- `document_id` (UUID FK -> documents.id)
- `user_id` (UUID FK -> users.id)
- `role` (String: `VIEWER`, `COMMENTER`, `EDITOR`)
- `created_at` / `updated_at` (DateTime)

### `document_states`
- `id` (UUID PK)
- `document_id` (UUID FK -> documents.id, Unique)
- `state_data` (Text): Compressed Yjs CRDT state snapshot
- `state_version` (Integer)
- `updated_at` (DateTime)

### `document_versions`
- `id` (UUID PK)
- `document_id` (UUID FK -> documents.id)
- `snapshot_data` (Text): Immutable historical document state
- `version_number` (Integer): Sequential version counter
- `created_by` (UUID FK -> users.id)
- `created_at` (DateTime)
- `version_type` (String: `AUTO`, `MANUAL`, `RESTORE`)

### `comments`
- `id` (UUID PK)
- `document_id` (UUID FK -> documents.id)
- `author_id` (UUID FK -> users.id)
- `parent_id` (UUID FK -> comments.id, nullable for top-level comments)
- `content` (Text): Comment message
- `resolved` (Boolean): Resolution status
- `created_at` / `updated_at` (DateTime)

### `document_activity`
- `id` (UUID PK)
- `document_id` (UUID FK -> documents.id)
- `user_id` (UUID FK -> users.id)
- `action` (String): Audited activity (e.g. `CREATE`, `RENAME`, `SHARE_EDITOR_alice@test.com`, `RESTORE_VERSION_v2`)
- `created_at` (DateTime)

---

## 4. Real-Time Collaboration & Synchronization Architecture

SyncWrite combines **TipTap**, **ProseMirror**, **Yjs CRDT**, and **Flask-SocketIO**:

```
React (Frontend)
   │
   ▼
TipTap Editor (Rich Text Toolbar)
   │
   ▼
ProseMirror State & Mutations
   │
   ▼
Yjs CRDT (Conflict-Free Replicated Data Type)
   │
   ├── Document Delta Updates
   └── Presence / Typing Awareness
   │
   ▼
Socket.IO Transport (WebSockets / Polling)
   │
   ▼
Flask-SocketIO Backend
   ├── Authentication Middleware
   ├── Document Room Isolation (document:{id})
   ├── Role-Based Authorization Enforcer
   └── State Persistence Engine
   │
   ▼
PostgreSQL Database
```

- **Conflict-Free Convergence**: When multiple clients type simultaneously, edits merge deterministically without overwriting each other or resorting to naive "last write wins" snapshot replacement.
- **Socket.IO Room Isolation**: Each document uses a dedicated room `document:{document_id}`.
- **Server Enforcement**: Before joining or broadcasting edits, the server validates token authentication and verifies document role (`OWNER` or `EDITOR`).

---

## 5. Role-Based Permissions Matrix

Authorization is enforced on **REST APIs**, **Socket.IO event handlers**, and **Database operations**:

| Permission / Action | Viewer | Commenter | Editor | Owner |
| :--- | :---: | :---: | :---: | :---: |
| Open & Read Document | ✅ | ✅ | ✅ | ✅ |
| View Active Collaborator Presence | ✅ | ✅ | ✅ | ✅ |
| View Version History | ✅ | ✅ | ✅ | ✅ |
| Add Comments & Reply to Threads | ❌ | ✅ | ✅ | ✅ |
| Resolve Comments | ❌ | ✅ | ✅ | ✅ |
| Edit Document Content | ❌ | ❌ | ✅ | ✅ |
| Rename Document | ❌ | ❌ | ✅ | ✅ |
| Create Manual Checkpoints & Restore Versions | ❌ | ❌ | ✅ | ✅ |
| Duplicate Document | ✅ | ✅ | ✅ | ✅ |
| Share Document & Manage Roles | ❌ | ❌ | ❌ | ✅ |
| Delete Document | ❌ | ❌ | ❌ | ✅ |

---

## 6. Persistence & Version History Strategy

### Collaboration Persistence & Auto-Save
- Modifications automatically update the Yjs CRDT state.
- Changes are debounced and saved into `document_states` in PostgreSQL.
- UI displays a real-time status badge: `Saving...` -> `Saved` -> `Reconnecting...`.
- Reloading the page or server restart instantly restores the exact state from PostgreSQL.

### History-Preserving Version Restoration
Restoring a previous version **does NOT delete existing history**.
1. User inspects historical timeline (`AUTO`, `MANUAL`, `RESTORE`).
2. User clicks "Restore Version".
3. The system applies the historical snapshot to the active `document_states`.
4. The system creates a **NEW** version entry in `document_versions` with `version_type = RESTORE` and increments `version_number`.
5. Full audit trail remains 100% intact.

---

## 7. API Reference & Socket.IO Events

### REST API Endpoints
- `POST /api/auth/register` — Account registration with password policy check
- `POST /api/auth/login` — User authentication & JWT issuance
- `POST /api/auth/refresh` — Token rotation
- `POST /api/auth/logout` — Revoke active session
- `GET  /api/auth/me` — Fetch authenticated user profile
- `GET  /api/auth/sessions` — List user sessions
- `POST /api/auth/sessions/revoke` — Revoke session(s)
- `GET  /api/auth/login-history` — Login audit history
- `GET  /api/documents` — Fetch My Documents, Shared With Me, Recent
- `POST /api/documents` — Create document
- `GET  /api/documents/:id` — Get document & state
- `PUT  /api/documents/:id` — Rename document (Editor/Owner)
- `DELETE /api/documents/:id` — Delete document (Owner only)
- `POST /api/documents/:id/duplicate` — Duplicate document
- `GET  /api/documents/:id/shares` — List document collaborators
- `POST /api/documents/:id/shares` — Add/Update collaborator role (Owner only)
- `DELETE /api/documents/:id/shares/:userId` — Remove collaborator (Owner only)
- `GET  /api/documents/:id/comments` — Fetch comment threads
- `POST /api/documents/:id/comments` — Add comment or reply
- `PUT  /api/comments/:id/resolve` — Toggle comment resolved status
- `DELETE /api/comments/:id` — Delete comment
- `GET  /api/documents/:id/versions` — List document versions
- `POST /api/documents/:id/versions` — Create manual checkpoint
- `POST /api/documents/:id/versions/:versionId/restore` — Restore version

### Socket.IO Events
- `document:join` — Authenticates & joins room `document:{id}`
- `document:leave` — Leaves document room
- `document:sync` — Server emits initial state payload
- `document:update` — Client emits / Server broadcasts delta updates
- `presence:update` — Real-time active collaborators list
- `cursor:update` — Live cursor positions & selection ranges
- `typing:status` — Real-time typing indicators

---

## 8. Local Setup & Execution Instructions

### Prerequisites
- Python 3.10+
- Node.js v18+
- PostgreSQL server running locally on port 5432

### Step 1: Clone & Environment Setup
```bash
cp .env.example .env
```

### Step 2: Install Backend Dependencies
```bash
cd backend
python -m pip install -r requirements.txt
```

### Step 3: Install Frontend Dependencies & Build
```bash
cd ../frontend
npm install
npm run build
```

### Step 4: Run Application
```bash
cd ../backend
python app.py
```
Open **`http://127.0.0.1:5000`** in your browser.

---

## 9. Testing

Run automated tests against PostgreSQL:
```bash
cd backend
python -m pytest -v
```

All 11 backend test suites verify authentication, password rules, brute-force lockout, token rotation, document CRUD, role-based authorization matrix, version history restoration, and comment threading.
