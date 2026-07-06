# C Drive Filling Up Fast - Quick Fix Guide

## Why is C Drive Filling Up?

During React development with face recognition, your C drive can fill up due to:

### 1. **Browser Cache** (Most Common)
- Chrome/Edge store cached files in `C:\Users\<YourUsername>\AppData\Local\`
- Face-api.js models (25 MB) × multiple cache entries
- Development Hot Module Replacement (HMR) builds
- **Can grow to 500MB-2GB during active development**

### 2. **npm Cache**
- Located in `C:\Users\<YourUsername>\AppData\Roaming\npm-cache`
- Can grow to several hundred MB

### 3. **Dev Build Files**
- `hrms/dist` folder gets rebuilt frequently
- Each build is ~50-100 MB

---

## Quick Fix (Do This Now)

### Step 1: Clear Browser Cache

**Chrome**:
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Time range: "All time"
4. Click "Clear data"

**Or via DevTools**:
1. Press `F12` (open DevTools)
2. Click "Application" tab
3. Expand "Storage" in left sidebar
4. Click "Clear site data"
5. Confirm

### Step 2: Clear npm Cache
```bash
npm cache clean --force
```

### Step 3: Clear Development Build
```bash
cd d:\Brostech\Office-01-Attendance-System\hrms
rmdir /s /q dist
```

---

## Permanent Solution

### 1. Move Chrome Cache (Recommended)
**Free up C drive permanently by moving browser cache to D drive**:

1. Close Chrome/Edge completely
2. Create new cache folder on D drive:
   ```cmd
   mkdir D:\BrowserCache\Chrome
   ```

3. Move existing cache:
   ```cmd
   xcopy /E /I "C:\Users\%USERNAME%\AppData\Local\Google\Chrome\User Data\Default\Cache" "D:\BrowserCache\Chrome"
   rmdir /s /q "C:\Users\%USERNAME%\AppData\Local\Google\Chrome\User Data\Default\Cache"
   ```

4. Create symbolic link:
   ```cmd
   mklink /D "C:\Users\%USERNAME%\AppData\Local\Google\Chrome\User Data\Default\Cache" "D:\BrowserCache\Chrome"
   ```

5. Restart Chrome

**Result**: Browser cache now uses D drive instead of C drive

### 2. Configure npm to Use D Drive
```bash
npm config set cache "D:\npm-cache" --global
```

### 3. Build to D Drive (Optional)
Edit `hrms/vite.config.js`:
```javascript
export default defineConfig({
  build: {
    outDir: 'D:/Build/hrms-dist'  // Use D drive for builds
  }
})
```

---

## Monitor Disk Usage

### Check Project Size
```powershell
cd d:\Brostech\Office-01-Attendance-System
Get-ChildItem -Recurse | Measure-Object -Property Length -Sum | Select-Object @{Name="SizeMB";Expression={[math]::Round($_.Sum/1MB, 2)}}
```

**Expected Output**: ~350 MB

### Check Browser Cache Size
```powershell
$cachePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache"
if (Test-Path $cachePath) {
    Get-ChildItem $cachePath -Recurse | Measure-Object -Property Length -Sum | Select-Object @{Name="SizeMB";Expression={[math]::Round($_.Sum/1MB, 2)}}
}
```

### Check npm Cache Size
```powershell
npm cache verify
```

---

## Development Best Practices

### 1. Clear Cache Weekly
Add to your routine:
```bash
# Clear browser cache weekly
# Clear npm cache monthly
npm cache clean --force
```

### 2. Use Production Build for Testing
Instead of `npm run dev`, use:
```bash
npm run build
npm run preview
```
**Benefits**:
- Smaller build size
- No HMR overhead
- Closer to production behavior

### 3. Delete Old Builds
```bash
# Before each new build
cd hrms
rm -rf dist
npm run build
```

### 4. Limit Browser Cache Size
**Chrome Settings**:
1. Go to `chrome://settings/`
2. Search "cache"
3. Set maximum cache size (via chrome flags)

---

## Face-API.js Models Caching

The face recognition models are stored in:
- `hrms/public/models/` (25 MB total)
- Browser caches them automatically
- No need to download repeatedly

**Models Included**:
1. `ssd_mobilenetv1_model` - Face detection (5 MB)
2. `face_landmark_68_model` - Facial landmarks (350 KB)
3. `face_recognition_model` - Face encoding (6 MB)

**How Caching Works**:
- First load: Downloads from `/public/models/`
- Subsequent loads: Uses browser cache (instant)
- Cache cleared: Re-downloads (25 MB)

---

## Troubleshooting

### "C drive still filling up after clearing cache"

**Check these locations**:
```powershell
# Windows temp files
Get-ChildItem $env:TEMP -Recurse | Measure-Object -Property Length -Sum

# VS Code cache
Get-ChildItem "$env:APPDATA\Code\Cache" -Recurse | Measure-Object -Property Length -Sum

# Node modules (shouldn't be on C drive if project is on D drive)
Get-ChildItem "C:\" -Filter "node_modules" -Recurse -Directory -ErrorAction SilentlyContinue
```

### "Models downloading every time"

**Check network tab** (F12 → Network):
- Look for requests to `/models/`
- If "200" response: Downloading (bad)
- If "304 Not Modified" or "(from memory cache)": Caching works (good)

**Fix**:
- Hard refresh: `Ctrl + Shift + R`
- Check `hrms/public/models/` folder exists
- Check `vite.config.js` has correct public directory

### "npm install fills C drive"

**If project is on D drive but npm installs to C drive**:
```bash
# Check npm prefix
npm config get prefix

# If showing C:\, change to project location
npm config set prefix "D:\Brostech\Office-01-Attendance-System"
```

---

## Expected Disk Usage

| Component | Size | Location |
|-----------|------|----------|
| Project files | 10 MB | D:\Brostech\... |
| hrms node_modules | 200 MB | D:\Brostech\...\hrms\ |
| backend node_modules | 100 MB | D:\Brostech\...\backend\ |
| Face-API models | 25 MB | D:\Brostech\...\hrms\public\ |
| Development build (dist) | 50 MB | D:\Brostech\...\hrms\dist\ |
| **Total Project** | **~385 MB** | **D: Drive** |
| | | |
| Browser cache | 100-500 MB | C:\Users\...\AppData\ |
| npm cache | 50-200 MB | C:\Users\...\AppData\ |
| **Total C Drive** | **~150-700 MB** | **C: Drive** |

---

## Summary

**Quick Fix** (Do now):
1. Clear browser cache (`Ctrl+Shift+Delete`)
2. Clear npm cache (`npm cache clean --force`)
3. Delete `hrms/dist` folder

**Long-term Solution**:
1. Move browser cache to D drive (symbolic link)
2. Configure npm cache to D drive
3. Clear cache weekly

**Expected Space**:
- Project on D drive: ~385 MB (acceptable)
- Browser cache on C drive: ~150-700 MB (normal for development)
- After moving cache to D drive: C drive usage < 50 MB

---

## Need More Help?

If C drive still filling up after these steps:
1. Run Windows Disk Cleanup (`cleanmgr`)
2. Check for large log files in `C:\Windows\Logs`
3. Use WinDirStat tool to visualize disk usage
4. Consider moving entire user profile to D drive (advanced)

**Contact**: Check with Windows system admin if C drive remains critically low after following all steps.
