# 📔 Personal Diary — MERN + Zero-Knowledge Encryption

> **Your diary is 100% private. Not even the server admin or database admin can read your entries.**

## 🔐 How Privacy Works

```
Your Password
     │
     ▼  PBKDF2 (100,000 iterations, SHA-256)
Encryption Key  ← never sent to server, never stored
     │
     ▼  AES-256-GCM  
Ciphertext ──► stored in MongoDB (looks like random bytes)
```

- ✅ Encryption/decryption happens **only in your browser**
- ✅ The server only ever receives and stores **ciphertext** (encrypted gibberish)
- ✅ Your encryption key is derived from your password and lives **only in browser memory**
- ✅ Closing the tab / logging out **wipes the key from memory**
- ✅ Even if someone dumps the entire MongoDB database, they see nothing

---

## 🛠️ Tech Stack

| | Technology |
|---|---|
| **Frontend** | React 18 + Vite + TailwindCSS v4 |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose |
| **Auth** | JWT (access token 15min + refresh token 7d) |
| **Client Encryption** | Web Crypto API — AES-256-GCM + PBKDF2 |
| **Server Auth** | bcrypt (login only, key is separate) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local) — [Download here](https://www.mongodb.com/try/download/community)

### 1. Start MongoDB
```bash
# Windows — start MongoDB service, or run:
mongod
```

### 2. Start the Backend Server
```bash
cd server
npm run dev
# Server runs at http://localhost:5000
```

### 3. Start the Frontend
```bash
cd client
npm run dev
# App runs at http://localhost:5173
```

### 4. Open your browser
Go to → **http://localhost:5173**

---

## 📁 Project Structure

```
Personal Diary/
├── server/
│   ├── src/
│   │   ├── config/db.js          # MongoDB connection
│   │   ├── models/
│   │   │   ├── User.js           # User (stores encSalt for key derivation)
│   │   │   └── Entry.js          # Entry (only stores ciphertext, IVs)
│   │   ├── routes/
│   │   │   ├── auth.js           # Register, Login, Refresh, Logout
│   │   │   └── entries.js        # CRUD for encrypted diary entries
│   │   ├── middleware/auth.js    # JWT protection
│   │   └── app.js               # Express setup
│   ├── index.js                  # Entry point
│   └── .env                      # Config (change JWT secrets!)
│
└── client/
    ├── src/
    │   ├── crypto/cryptoUtils.js # AES-256-GCM + PBKDF2 (THE CORE)
    │   ├── api/apiClient.js      # Axios + JWT auto-refresh
    │   ├── context/AuthContext   # Auth state + key in memory
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx     # Lists entries (decrypts titles)
    │   │   ├── NewEntry.jsx      # Write + encrypt before send
    │   │   └── ViewEntry.jsx     # Fetch + decrypt to display
    │   └── components/
    │       ├── Navbar.jsx
    │       ├── EntryCard.jsx
    │       └── MoodPicker.jsx
    └── .env
```

---

## ⚙️ Environment Variables

### `server/.env`
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/personal_diary
JWT_SECRET=change_this_to_a_random_32+_char_string
JWT_REFRESH_SECRET=change_this_to_another_random_32+_char_string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

> ⚠️ **Change the JWT secrets before deploying!** Use a random 32+ character string.

### `client/.env`
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 🔍 Verify It's Really Encrypted

After writing an entry, open MongoDB Compass or run:
```bash
mongosh personal_diary
db.entries.findOne()
```

You'll see something like:
```json
{
  "encryptedTitle": "k3jH9xZmP2aBcDeFgHiJkL...",
  "encryptedContent": "mNoPqRsTuVwXyZaBcDeFgH...",
  "iv": "xYzAbCdEfGhIjKlM",
  "ivContent": "nOpQrStUvWxYzAbC",
  "mood": "happy"
}
```

**No plaintext. Ever.** 🔐

---

## ✨ Features

- 📝 Write, edit, delete diary entries
- 🔐 AES-256-GCM encryption (browser-side, zero-knowledge)
- 😊 Mood tracking (Happy, Sad, Excited, Grateful, etc.)
- 🔍 Search entries by title
- 🎨 Beautiful amber/warm UI
- 📱 Responsive design
- 🔄 Auto JWT refresh
- 🚀 Rate limiting + security headers
