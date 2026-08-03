# SyncWrite Demonstration & Engineering Guide

This guide provides a comprehensive demonstration script, architectural breakdown, and evaluator rubric for **SyncWrite — Real-Time Collaborative Document Editor**.

---

## 🎬 5–10 Minute Video Demonstration Script

### Scene 1: Security & Identity Foundation (1.5 Mins)
1. **Registration & Password Policy**:
   - Navigate to `http://127.0.0.1:5000/register`.
   - Register account `alice@syncwrite.com` (Name: "Alice Lead", Password: `Password123`).
   - Demonstrate policy validation (attempting short or numberless password fails).
2. **Brute-Force Lockout Protection**:
   - Attempt logging in as `alice@syncwrite.com` with an incorrect password 5 times.
   - Show the progressive lockout message (`HTTP 429: Account locked for 300 seconds`).
3. **Login & Session Management**:
   - Log in successfully as `alice@syncwrite.com`.
   - Navigate to **Sessions & Audit Log** (`/sessions`).
   - Show active sessions, IP address, User-Agent, and full login audit trail (`login_attempts`).
   - Demonstrate remote session revocation.

---

### Scene 2: Document Management & Dashboard (1 font-heading Min)
1. **Interactive Dashboard**:
   - Display the three document categorization tabs: **My Documents**, **Shared With Me**, and **Recent Documents**.
2. **Document Lifecycle**:
   - Click **New Document** and create `"Q4 Investor Pitch Deck"`.
   - Demonstrate document metadata display (Owner, Date Created, Last Modified, User Role Badge: `OWNER`).
   - Show document duplication (`Copy of Q4 Investor Pitch Deck`) and document renaming.

---

### Scene 3: Real-Time CRDT Collaboration & Presence (3 Mins)
1. **Side-by-Side Browser Windows**:
   - Window A: Logged in as **Alice (Owner)**.
   - Window B: Logged in as **Bob (Editor)** (`bob@syncwrite.com`).
   - Alice shares `"Q4 Investor Pitch Deck"` with Bob as **EDITOR**.
2. **Concurrent Real-Time Editing**:
   - Bob opens the document.
   - Both users see active presence avatars in top header: `🟢 Alice Lead (OWNER)`, `🟢 Bob Editor (EDITOR)`.
   - Alice and Bob edit different paragraphs simultaneously.
   - **Observe**: Text merges instantly without browser refresh, lag, or data loss. Conflict-free CRDT resolution ensures 100% document consistency.
3. **Live Indicators**:
   - Highlight live typing indicator (`Bob is typing...`).
   - Show auto-save status transition: `Saving...` -> `Saved`.

---

### Scene 4: Role-Based Authorization Enforcement (1.5 Mins)
1. **Sharing with Viewer Role**:
   - Alice shares the document with **Charlie** (`charlie@syncwrite.com`) as **VIEWER**.
2. **Server-Side Security Enforcement**:
   - Charlie opens the document.
   - The toolbar is disabled; editor is read-only.
   - Attempting to bypass frontend and emit direct Socket.IO document updates is rejected by backend permission middleware (`Permission denied. Viewer/Commenter cannot modify document.`).

---

### Scene 5: Comments & Version History (2 Mins)
1. **Threaded Comments**:
   - Bob adds a comment: *"Should we highlight our 150% QoQ growth here?"*.
   - Alice replies: *"Great idea! Added to slide 3."*.
   - Alice marks comment thread as **Resolved** (`CheckCircle`).
2. **Version History & History-Preserving Restore**:
   - Alice opens **Version History** drawer (`/versions`).
   - Click **Create Checkpoint** to store manual milestone `Version #2 (MANUAL)`.
   - Bob makes a major edit.
   - Alice restores `Version #1`.
   - **Notice**: Restoring creates a **NEW** `Version #3 (RESTORE)` checkpoint while keeping `Version #1` and `Version #2` intact. Audit trail is completely preserved.

---

## 🏛️ Architectural Highlights

- **Database**: 100% PostgreSQL (`postgresql://postgres:postgres@localhost:5432/syncwrite`) via SQLAlchemy ORM.
- **CRDT Model**: Yjs state vectors + TipTap ProseMirror DOM representation.
- **Real-Time Communication**: Flask-SocketIO rooms (`document:{id}`).
- **Permissions**: Decoupled Authentication ("Who is the user?") and Authorization ("What role do they have on this document?").

---

## 🧪 Verification & Automated Testing

Run backend pytest suite:
```bash
cd backend
python -m pytest -v
```
**Results**: `11 passed in 4.45s` covering registration, password rules, brute-force lockout, token rotation, document CRUD, role-based authorization matrix, version restoration, and comment threading.
