# Build Test Guide

## Test Deployment Build Locally

Before deploying, test that the build process works correctly:

### 1. Clean Previous Build
```bash
rm -rf public/*   # Linux/Mac
Remove-Item public\* -Recurse -Force   # Windows PowerShell
```

### 2. Run Full Build
```bash
npm run build
```

**Expected output:**
```
> cd frontend && npm install && npm run build && cd ..

up to date, audited 251 packages in 1s
✓ built in 1.21s
```

### 3. Verify Build Output
```bash
ls public/   # Linux/Mac
dir public\  # Windows
```

**Should contain:**
- `index.html`
- `assets/` folder with JS and CSS files
- `vite.svg` (optional)

### 4. Test Production Server
```bash
# Set production mode
export NODE_ENV=production   # Linux/Mac
$env:NODE_ENV="production"   # Windows PowerShell

# Start server
npm start
```

### 5. Access Application
Open browser: `http://localhost:3000`

**Should work:**
- ✅ Homepage loads
- ✅ Login/Register works
- ✅ Video upload works
- ✅ Video streaming works
- ✅ SPA routing works (no 404s when navigating)

### 6. Reset to Development
```bash
unset NODE_ENV   # Linux/Mac
Remove-Item Env:\NODE_ENV   # Windows PowerShell
```

---

## Deployment Build Process

When you deploy to Railway/Render/etc:

### Railway:
```bash
1. git push
2. Railway detects push
3. Runs: npm install
4. Runs: npm run build (builds frontend → public/)
5. Runs: npx prisma generate
6. Runs: npx prisma migrate deploy
7. Runs: npm start
```

### Render (using render.yaml):
```bash
1. git push
2. Render runs buildCommand:
   - npm install
   - cd frontend && npm install && npm run build
   - npx prisma generate
3. Render runs startCommand:
   - npx prisma migrate deploy && npm start
```

---

## Troubleshooting

### Issue: `public/` is empty after build
**Fix:** Check `frontend/vite.config.js`:
```javascript
build: {
  outDir: '../public',
  emptyOutDir: true,
}
```

### Issue: Assets not loading (404 errors)
**Fix:** Check asset paths in built `index.html` start with `/`:
```html
<script src="/assets/index-xxx.js"></script>
```

### Issue: Routing doesn't work (404 on refresh)
**Fix:** Server has SPA fallback in `server.js`:
```javascript
// SPA fallback for non-API routes
if (!pathname.startsWith('/api') && !pathname.startsWith('/video')) {
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html');
}
```

---

## Build Performance

**Local build time:** ~1-2 seconds  
**Deployment build time:** ~1-3 minutes (includes npm install)  
**Bundle size:** ~330 KB (gzipped: ~107 KB)

---

## Next Steps

After successful build test:
1. ✅ Commit changes (excluding `public/`)
2. ✅ Push to GitHub
3. ✅ Deploy to Railway/Render
4. ✅ Monitor deployment logs

