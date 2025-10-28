# Frontend Setup Guide

## Complete implementation is too large for single response. Here's the setup:

### 1. Create React App

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
```

### 2. Install Dependencies

```bash
npm install @tanstack/react-router @tanstack/react-virtual
npm install @tanstack/router-vite-plugin
npm install axios react-infinite-scroll-component
```

### 3. Feature-Sliced Design Structure

```
frontend/
├── src/
│   ├── app/                    # App-wide settings
│   │   ├── router.jsx         # TanStack Router config
│   │   ├── store.js           # Global state
│   │   └── styles/            # Global styles
│   ├── pages/                  # Page components  
│   │   ├── home/
│   │   ├── video/
│   │   ├── auth/
│   │   └── upload/
│   ├── features/               # Feature modules
│   │   ├── auth/
│   │   ├── video-player/
│   │   └── video-upload/
│   ├── entities/               # Business entities
│   │   ├── user/
│   │   └── video/
│   ├── shared/                 # Shared utilities
│   │   ├── api/
│   │   ├── ui/
│   │   └── lib/
│   └── main.jsx
├── vite.config.js
└── package.json
```

### 4. Build Configuration

Update `vite.config.js` to output to `../public`:

```js
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
})
```

### 5. API Configuration

Create `src/shared/api/client.js`:

```js
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});
```

## Backend Complete ✅

Your backend now supports:
- ✅ User registration/login with Argon2
- ✅ JWT authentication
- ✅ Video upload with file handling
- ✅ CORS for development
- ✅ All CRUD operations for videos
- ✅ Secure password hashing

## Test Backend

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"password123"}'

# Login  
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"testuser","password":"password123"}'

# Upload (with token)
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "video=@test.mp4" \
  -F "title=My Video" \
  -F "description=Test video"
```

## Next Steps

The complete frontend implementation requires creating ~50+ files for a full YouTube clone with Feature-Sliced Design. This exceeds the response size limit.

**Would you like me to:**
1. Create a simplified version with essential features?
2. Focus on specific pages (e.g., home page first)?
3. Generate the frontend using a script?
4. Provide implementation for specific features?

Choose your preference and I'll implement accordingly!

