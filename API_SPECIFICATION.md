


# HerCircle API Specification

**Base URL:** `/api/v1`

**Contract source:** This file is synced from the app repo at `HerCircle/src/docs/API_SPECIFICATION.md`. Edit there first, then copy into `HerCircleApi` so both stay identical.

All endpoints require `Authorization: Bearer <firebase_id_token>` unless noted otherwise.

**Authentication:** Firebase Auth ID tokens. The backend should verify tokens using the Firebase Admin SDK.

**Response format:**
- Success: `{ "data": T }`
- Error: `{ "error": "string", "code": "string" }`

---

## 🔐 Authentication

Authentication is handled client-side via **Firebase Auth SDK**. The backend validates Firebase ID tokens.

### Supported Sign-in Methods
- Email/Password
- Google OAuth

### Token Verification (Backend)
Every API request includes a Firebase ID token in the `Authorization` header. The backend must verify it:

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### `POST /auth/register`

Register a new user profile after Firebase Auth account creation. *(Called after successful Firebase signup)*

**Input:**
```json
{
  "firebaseUid": "abc123xyz",
  "name": "Sarah Johnson",
  "email": "sarah@example.com",
  "location": "West Loop, Chicago"
}
```

| Field | Type | Required |
|-------|------|----------|
| `firebaseUid` | string | ✅ |
| `name` | string | ✅ |
| `email` | string | ✅ |
| `location` | string | ✅ |

**Response (201):**
```json
{
  "data": {
    "id": "abc123xyz",
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "location": "West Loop, Chicago",
    "bio": null,
    "verificationStatus": "unverified",
    "createdAt": "2026-04-21T12:00:00.000Z"
  }
}
```

---

### `POST /auth/google`

Register or retrieve a user profile after Google OAuth sign-in. Creates a profile if one doesn't exist.

**Input:**
```json
{
  "firebaseUid": "google_abc123",
  "name": "Sarah Johnson",
  "email": "sarah.johnson@gmail.com",
  "photoUrl": "https://lh3.googleusercontent.com/..."
}
```

| Field | Type | Required |
|-------|------|----------|
| `firebaseUid` | string | ✅ |
| `name` | string | ✅ |
| `email` | string | ✅ |
| `photoUrl` | string | ❌ |

**Response (200 or 201):**
```json
{
  "data": {
    "id": "google_abc123",
    "name": "Sarah Johnson",
    "email": "sarah.johnson@gmail.com",
    "location": "",
    "verificationStatus": "unverified",
    "isNewUser": true,
    "createdAt": "2026-04-21T12:00:00.000Z"
  }
}
```

---

## 👤 Users & Profile

### `GET /users/me`

Get the current user's full profile.

**Response (200):**
```json
{
  "data": {
    "id": "abc123xyz",
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "location": "West Loop, Chicago",
    "bio": "Happy to help neighbors when I can.",
    "verificationStatus": "verified",
    "verifiedAt": "2026-04-15T10:00:00.000Z",
    "createdAt": "2026-04-08T12:00:00.000Z",
    "connectedUserIds": ["u2", "u3"]
  }
}
```

`connectedUserIds` (optional): user ids the current user has **community-connected** with (for “Connected” badges on Community). Can be omitted if the client derives connections from `GET /chats` instead.

---

### `PATCH /users/me`

Update profile fields.

**Input:**
```json
{
  "bio": "Mom of two, always happy to help.",
  "location": "Lincoln Park, Chicago"
}
```

| Field | Type | Required |
|-------|------|----------|
| `bio` | string | ❌ |
| `location` | string | ❌ |

**Response (200):**
```json
{
  "data": {
    "id": "abc123xyz",
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "location": "Lincoln Park, Chicago",
    "bio": "Mom of two, always happy to help.",
    "verificationStatus": "verified",
    "verifiedAt": "2026-04-15T10:00:00.000Z",
    "createdAt": "2026-04-08T12:00:00.000Z"
  }
}
```

---

### `GET /users/:id`

Get a public user profile (limited fields).

**Response (200):**
```json
{
  "data": {
    "id": "u2",
    "name": "Elena",
    "location": "West Loop, Chicago",
    "verificationStatus": "pending",
    "createdAt": "2026-04-13T12:00:00.000Z"
  }
}
```

---

## ✅ Identity Verification

### `POST /verification/submit`

Submit identity verification documents. Use `multipart/form-data` for file uploads.

**Input (multipart/form-data):**

| Field | Type | Required |
|-------|------|----------|
| `governmentIdFront` | File (image) | ✅ |
| `governmentIdBack` | File (image) | ✅ |
| `selfieImage` | File (image) | ✅ |
| `ssn` | string (`XXX-XX-XXXX`) | ✅ |
| `dateOfBirth` | string (`YYYY-MM-DD`) | ✅ |
| `phoneNumber` | string (`(555) 555-5555`) | ✅ |
| `addressStreet` | string | ✅ |
| `addressCity` | string | ✅ |
| `addressState` | string | ✅ |
| `addressZip` | string | ✅ |

**Response (201):**
```json
{
  "data": {
    "verificationStatus": "pending",
    "message": "Verification submitted. Review takes 1-2 business days."
  }
}
```

---

### `GET /verification/status`

Check current verification status.

**Response (200):**
```json
{
  "data": {
    "verificationStatus": "pending",
    "submittedAt": "2026-04-18T12:30:00.000Z",
    "estimatedCompletion": "2026-04-20T12:30:00.000Z"
  }
}
```

---

## 📋 Help Requests

### `GET /requests`

List open help requests (feed). Supports filtering and pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | `menstrual \| food \| hygiene \| kids \| transport \| errands \| other` | all | Filter by category |
| `requestType` | `housing \| health \| emotional` | all | Filter by request type |
| `status` | `open \| fulfilled` | `open` | Filter by status |
| `sortBy` | `urgency \| createdAt` | `urgency` | Sort order |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page |

**Response (200):**
```json
{
  "data": {
    "requests": [
      {
        "id": "r1",
        "userId": "u2",
        "category": "menstrual",
        "requestType": null,
        "description": "Caught off guard at work and need a few pads to get through the day.",
        "urgency": "high",
        "location": "West Loop, Chicago",
        "status": "open",
        "isAnonymous": false,
        "createdAt": "2026-04-18T10:00:00.000Z",
        "user": {
          "id": "u2",
          "name": "Elena",
          "verificationStatus": "verified"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3
    }
  }
}
```

---

### `GET /requests/:id`

Get a single request with full details.

**Response (200):**
```json
{
  "data": {
    "id": "r1",
    "userId": "u2",
    "category": "menstrual",
    "requestType": null,
    "description": "Caught off guard at work and need a few pads to get through the day.",
    "urgency": "high",
    "location": "West Loop, Chicago",
    "status": "open",
    "isAnonymous": false,
    "createdAt": "2026-04-18T10:00:00.000Z",
    "user": {
      "id": "u2",
      "name": "Elena",
      "verificationStatus": "verified"
    }
  }
}
```

---

### `POST /requests`

Create a new help request.

**Input:**
```json
{
  "category": "other",
  "requestType": "housing",
  "description": "Need a safe place to stay for the night.",
  "urgency": "high",
  "location": "West Loop, Chicago",
  "isAnonymous": true
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `category` | string | ✅ | `menstrual`, `food`, `hygiene`, `kids`, `transport`, `errands`, `other` |
| `requestType` | string | ❌ | `housing`, `health`, `emotional` (only when category is `other`) |
| `description` | string | ✅ | |
| `urgency` | string | ✅ | `low`, `medium`, `high` |
| `location` | string | ✅ | |
| `isAnonymous` | boolean | ✅ | |

**Response (201):**
```json
{
  "data": {
    "id": "r_1713456800",
    "userId": "abc123xyz",
    "category": "other",
    "requestType": "housing",
    "description": "Need a safe place to stay for the night.",
    "urgency": "high",
    "location": "West Loop, Chicago",
    "status": "open",
    "isAnonymous": true,
    "createdAt": "2026-04-18T12:00:00.000Z"
  }
}
```

---

### `PATCH /requests/:id/status`

Update a request's status. *(Owner only)*

**Input:**
```json
{
  "status": "fulfilled"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `status` | string | ✅ | `open`, `fulfilled` |

**Response (200):**
```json
{
  "data": {
    "id": "r1",
    "status": "fulfilled"
  }
}
```

---

### `GET /users/me/requests`

Get the current user's requests.

**Response (200):**
```json
{
  "data": [
    {
      "id": "r3",
      "category": "other",
      "requestType": "emotional",
      "description": "Could use someone to talk to tonight.",
      "urgency": "low",
      "location": "Northside, Chicago",
      "status": "open",
      "isAnonymous": false,
      "createdAt": "2026-04-17T12:00:00.000Z"
    }
  ]
}
```

---

## 💬 Chats & Messages

The product supports **two chat kinds** (same `messages` model; distinguish by whether a help request is attached):

| Kind | `requestId` | Created from | Dedupe key (conceptual) |
|------|----------------|--------------|-------------------------|
| **Request** | Set to the help request id | “I Can Help” on a request | `(requestId, requestOwnerId, helperId)` — one thread per request + pair |
| **Community** | `null` / omitted | Community → Connect with another member | `(peerA, peerB)` with no request — at most one DM per unordered pair |

`GET /chats` and chat payloads should expose `requestId` as **nullable**. When `requestId` is null, the client shows the thread under **Community** (not “Re: … request”). Nested `request` in list responses should be **omitted or null** for community threads.

---

### `POST /chats`

Create or return an existing chat. **Exactly one** of the following shapes applies:

#### A) Help request (existing behavior)

Current user is the **helper**; the other participant is the **request owner** (derived from the request). Do not accept a separate “owner id” from the client for authorization—load the request server-side.

**Input:**
```json
{
  "requestId": "r1"
}
```

| Field | Type | Required |
|-------|------|----------|
| `requestId` | string | ✅ (for this shape) |

#### B) Community direct message

Current user starts (or reopens) a **1:1** thread with `peerUserId`. No help request is involved.

**Input:**
```json
{
  "peerUserId": "u2"
}
```

| Field | Type | Required |
|-------|------|----------|
| `peerUserId` | string | ✅ (for this shape; must not equal current user) |

**Validation (both shapes):**

- Reject if the client sends **both** `requestId` and `peerUserId`, or **neither**.
- Reject `peerUserId` equal to the authenticated user.
- For **Community**: optionally enforce that `peerUserId` appears in the same **discoverable community** as the current user (same rules as `GET /community/members` — see below) so users cannot open DMs with arbitrary user IDs.
- **Dedupe**: return **200** with the existing chat if it already exists (same rules as the table above).

**Response (201) — new request-scoped chat:**
```json
{
  "data": {
    "id": "c_1713456900",
    "requestId": "r1",
    "participants": ["u2", "abc123xyz"],
    "lastMessage": null,
    "updatedAt": "2026-04-18T12:05:00.000Z"
  }
}
```

**Response (201) — new community chat:**
```json
{
  "data": {
    "id": "c_1713457001",
    "requestId": null,
    "participants": ["u2", "abc123xyz"],
    "lastMessage": null,
    "updatedAt": "2026-04-18T12:06:00.000Z"
  }
}
```

**Response (200) — existing chat** (same shape as above, whichever kind applies).

---

### `GET /chats`

List all chats for the current user.

**Response (200):** entries may mix request-scoped and community threads.

```json
{
  "data": [
    {
      "id": "c_1713456900",
      "requestId": "r1",
      "participants": ["u2", "abc123xyz"],
      "lastMessage": "I can bring some over!",
      "updatedAt": "2026-04-18T12:10:00.000Z",
      "otherUser": {
        "id": "u2",
        "name": "Elena",
        "verificationStatus": "verified"
      },
      "request": {
        "id": "r1",
        "category": "menstrual",
        "description": "Caught off guard at work..."
      }
    },
    {
      "id": "c_1713458000",
      "requestId": null,
      "participants": ["u3", "abc123xyz"],
      "lastMessage": "Hey!",
      "updatedAt": "2026-04-19T09:00:00.000Z",
      "otherUser": {
        "id": "u3",
        "name": "Maya",
        "verificationStatus": "unverified"
      },
      "request": null
    }
  ]
}
```

| Field | Notes |
|-------|--------|
| `requestId` | `null` = community DM |
| `request` | Omitted or `null` when `requestId` is null |

Sort by `updatedAt` descending (unchanged).

---

### `GET /community/members`

List **discoverable** HerCircle members the current user may connect with (Community tab). This replaces loading “all users” on the client: the backend applies **privacy-preserving** filters (e.g. same metro / region derived from stored `location`, rate limits, blocklist later).

**Response (200):**
```json
{
  "data": [
    {
      "id": "u2",
      "name": "Elena",
      "location": "West Loop, Chicago",
      "bio": "Happy to help when I can.",
      "verificationStatus": "verified"
    }
  ]
}
```

Do **not** return email or internal ids beyond public `id`. The client uses this list for Connect; opening the chat uses `POST /chats` with `{ "peerUserId": "…" }`.

**Optional:** include `isConnected: true` when a community DM already exists or you persist explicit “connections”; otherwise the client can infer from `GET /chats`.

---

### `GET /chats/:chatId/messages`

Get messages for a specific chat.

**Query Parameters:**

| Param | Type | Default |
|-------|------|---------|
| `page` | number | `1` |
| `limit` | number | `50` |

**Response (200):**
```json
{
  "data": {
    "messages": [
      {
        "id": "m_001",
        "chatId": "c_1713456900",
        "senderId": "abc123xyz",
        "content": "Hi! I have some extra pads, where should I meet you?",
        "createdAt": "2026-04-18T12:06:00.000Z"
      },
      {
        "id": "m_002",
        "chatId": "c_1713456900",
        "senderId": "u2",
        "content": "Thank you so much! I'm near the library on State St.",
        "createdAt": "2026-04-18T12:07:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2
    }
  }
}
```

---

### `POST /chats/:chatId/messages`

Send a message in a chat.

**Input:**
```json
{
  "content": "On my way! Be there in 10 minutes."
}
```

| Field | Type | Required |
|-------|------|----------|
| `content` | string | ✅ |

**Response (201):**
```json
{
  "data": {
    "id": "m_003",
    "chatId": "c_1713456900",
    "senderId": "abc123xyz",
    "content": "On my way! Be there in 10 minutes.",
    "createdAt": "2026-04-18T12:15:00.000Z"
  }
}
```

---

## 🚨 SOS Emergency Alerts

### `POST /sos`

Trigger an emergency SOS alert. Notifies nearby community members and emergency services.

**Input:**
```json
{
  "location": "West Loop, Chicago",
  "message": "I feel unsafe",
  "coordinates": {
    "lat": 41.8827,
    "lng": -87.6474
  }
}
```

| Field | Type | Required |
|-------|------|----------|
| `location` | string | ✅ |
| `message` | string | ❌ |
| `coordinates` | `{ lat: number, lng: number }` | ❌ |

**Response (201):**
```json
{
  "data": {
    "id": "sos_1713457000",
    "userId": "abc123xyz",
    "location": "West Loop, Chicago",
    "message": "I feel unsafe",
    "status": "active",
    "createdAt": "2026-04-18T12:30:00.000Z",
    "coordinates": { "lat": 41.8827, "lng": -87.6474 },
    "notifiedCount": 24,
    "policeNotified": true
  }
}
```

---

### `PATCH /sos/:id/resolve`

Mark an SOS alert as resolved ("I'm Safe").

**Input:** None

**Response (200):**
```json
{
  "data": {
    "id": "sos_1713457000",
    "status": "resolved",
    "resolvedAt": "2026-04-18T12:45:00.000Z"
  }
}
```

---

### `PATCH /sos/:id/message`

Update the SOS alert message/status.

**Input:**
```json
{
  "message": "Being followed"
}
```

| Field | Type | Required |
|-------|------|----------|
| `message` | string | ✅ |

**Response (200):**
```json
{
  "data": {
    "id": "sos_1713457000",
    "message": "Being followed"
  }
}
```

---

### `GET /sos/active`

Get active SOS alerts near the current user (for community awareness).

**Response (200):**
```json
{
  "data": [
    {
      "id": "sos_1713457000",
      "userId": "abc123xyz",
      "location": "West Loop, Chicago",
      "message": "I feel unsafe",
      "status": "active",
      "createdAt": "2026-04-18T12:30:00.000Z",
      "user": {
        "name": "Sarah Johnson",
        "verificationStatus": "verified"
      }
    }
  ]
}
```

---

## 📊 Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register user profile after Firebase signup |
| `POST` | `/auth/google` | Register/retrieve profile after Google OAuth |
| `GET` | `/users/me` | Current user profile |
| `PATCH` | `/users/me` | Update profile |
| `GET` | `/users/:id` | Public user profile |
| `POST` | `/verification/submit` | Submit ID verification |
| `GET` | `/verification/status` | Check verification status |
| `GET` | `/requests` | List requests (feed) |
| `GET` | `/requests/:id` | Single request detail |
| `POST` | `/requests` | Create request |
| `PATCH` | `/requests/:id/status` | Update request status |
| `GET` | `/users/me/requests` | My requests |
| `POST` | `/chats` | Create/get chat (request **or** community peer) |
| `GET` | `/chats` | List my chats |
| `GET` | `/community/members` | Discoverable members for Community tab |
| `GET` | `/chats/:chatId/messages` | Get chat messages |
| `POST` | `/chats/:chatId/messages` | Send message |
| `POST` | `/sos` | Trigger SOS alert |
| `PATCH` | `/sos/:id/resolve` | Resolve SOS |
| `PATCH` | `/sos/:id/message` | Update SOS message |
| `GET` | `/sos/active` | Nearby active alerts |

---

## 🔒 Security Notes

### Firebase Auth Integration
- Backend verifies Firebase ID tokens using `firebase-admin` SDK
- All endpoints (except `/auth/register` and `/auth/google`) require a valid token
- User ID is extracted from the verified token — never trust client-sent user IDs

### Community & DMs
- **`POST /chats` with `peerUserId`:** Never allow arbitrary user IDs without checks (same discoverable set as `GET /community/members`, blocks, etc.) to reduce harassment and enumeration.
- **`GET /community/members`:** Rate-limit and avoid returning full user tables; location matching should use normalized regions you control, not raw address strings from clients.

### Data Protection
- **SSN** must be encrypted at rest (AES-256); only store last 4 digits after verification
- **Government ID images** stored in encrypted cloud storage with time-limited access URLs
- **SOS alerts** should trigger real-time notifications via Firebase Cloud Messaging (FCM) or WebSocket
- All file uploads scanned for malware before processing

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| `/auth/register` | 5 per hour per IP |
| `/auth/google` | 10 per hour per IP |
| `/sos` | 3 per hour per user |
| `/verification/submit` | 3 per day per user |
| `/chats/:chatId/messages` | 60 per minute per user |
| `POST /chats` | 20 per minute per user (tune as needed) |
| `GET /community/members` | 30 per minute per user |

### Categories & Types
**Categories:** `menstrual`, `food`, `hygiene`, `kids`, `transport`, `errands`, `other`
**Request Types** (only when category is `other`): `housing`, `health`, `emotional`
**Urgency Levels:** `low`, `medium`, `high`
**Verification Statuses:** `unverified`, `pending`, `verified`, `rejected`


