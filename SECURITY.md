# SECURITY.md - Authentication & Identity System (Task 1)

This document details the security controls implemented in Task 1 and describes how they satisfy security requirements.

## 1. Password Policy & Strength Check
* **Requirement**: Enforce a strong password policy (length 12+), reject common/breached passwords, and require zxcvbn-style scoring.
* **Satisfied by**: 
  - **Strength & Entropy Validation**: We use `zxcvbn` to evaluate password strength. Rather than simple rules (which users satisfy with predictable patterns like `Password123!`), `zxcvbn` runs pattern and dictionary checks. We enforce a minimum length of 12 and require an entropy score of `3` or higher (on a scale of 0 to 4).
  - **HaveIBeenPwned Integration (k-anonymity)**: To prevent users from registering with leaked credentials, we check the HaveIBeenPwned API. We use the **k-anonymity** protocol: we calculate the password's SHA-1 hash, send *only* the first 5 characters of the hash to the API, and check the returned suffix list locally. The plain password or the full hash is never exposed to the third-party API.
  - **Fail-Open Resilience**: If the external HaveIBeenPwned API is unreachable or times out, the check fails open (defaults to safe). This prevents third-party outages from causing a denial-of-service to our registration/reset pipelines.

## 2. Password Storage & Hashing
* **Requirement**: Hash passwords with Argon2id. Never store or log plaintext passwords.
* **Satisfied by**:
  - **Argon2id Hashing Profile**: Passwords are hashed using the state-of-the-art `argon2id` algorithm, which is highly resistant to both side-channel timing attacks and GPU/ASIC-accelerated brute-forcing.
  - **Secure Cryptographic Parameters**: We use OWASP-recommended parameters:
    - Memory: `65536` KB (64 MB)
    - Time/iterations: `3`
    - Parallelism: `4` threads
  - **HMAC-SHA256 Pepper**: To prevent precomputation attacks (e.g., rainbow tables) in the event of a database compromise, we sign passwords with a server-side `PEPPER` key using HMAC-SHA256 before hashing them with Argon2. This fixed-length pre-hashing also prevents password truncation attacks (some argon2 implementations limit inputs to 72 bytes).

## 3. Password Reset Security
* **Requirement**: Implement single-use, short-lived, unguessable, and hashed tokens sent by email.
* **Satisfied by**:
  - **Unguessable Tokens**: Reset tokens are generated as 32-byte cryptographically secure random hex strings (`crypto.randomBytes(32)`), yielding 256 bits of entropy.
  - **Hashed Token Storage**: To prevent an attacker with read-only database access from hijacking reset flows, we never store the plain reset token in the database. Instead, we hash the token using SHA-256 and store only the hash. Lookups are performed by hashing the incoming token and querying the matching hash.
  - **Single-Use Constraint**: Tokens are strictly single-use. When a password is reset, the token is updated with a `usedAt` timestamp. The API rejects tokens where `usedAt` is not null.
  - **Short Lifetime**: Reset tokens expire after 15 minutes.
  - **Hoarding Prevention**: Generating a new password reset request automatically invalidates any existing active reset tokens for that user by updating their expiration to the current time.

## 4. Protection Against User Enumeration
* **Requirement**: Avoid disclosing user presence during auth flows.
* **Satisfied by**:
  - **Generic Forgot Password Responses**: The `/auth/password/forgot` endpoint returns a generic message (`"If an account exists with that email, a password reset link has been sent."`) regardless of whether the email is registered in our database. This prevents attackers from scanning the database to harvest valid email addresses.
