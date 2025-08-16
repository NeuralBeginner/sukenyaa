# 🔧 Android Troubleshooting Guide

This guide helps resolve common issues when using SukeNyaa with Stremio on Android devices.

## 🚨 Common Issues and Solutions

### 1. "Add-on couldn't be detected" Error

**Symptoms:**
- Stremio says the addon URL is invalid
- Error: "Add-on couldn't be detected"

**Solutions:**
1. **Check server status** in Termux:
   ```bash
   curl http://localhost:3000/manifest.json
   ```
   Should return JSON data, not an error.

2. **Verify server is running:**
   ```bash
   ps aux | grep node
   ```
   You should see the SukeNyaa process running.

3. **Check the correct URL format:**
   - ✅ Correct: `http://localhost:3000/manifest.json`
   - ❌ Wrong: `http://127.0.0.1:3000/manifest.json`
   - ❌ Wrong: `http://localhost:3000/` (missing manifest.json)

4. **Restart the server:**
   ```bash
   # In Termux, stop with Ctrl+C, then restart
   npm start
   ```

### 2. Empty Catalog / No Content Showing

**Symptoms:**
- Catalog loads but shows no items
- "No results found" message
- Infinite loading

**Solutions:**
1. **Test the catalog endpoint:**
   ```bash
   curl "http://localhost:3000/catalog/anime/nyaa-anime-all.json"
   ```

2. **Check network connectivity:**
   ```bash
   curl -I https://nyaa.si
   ```
   Should return HTTP 200 OK.

3. **Verify Android diagnostic:**
   ```bash
   curl http://localhost:3000/api/android-diagnostic
   ```

4. **Check for network restrictions:**
   - Some networks block nyaa.si
   - Try switching between WiFi and mobile data
   - Use a VPN if necessary

5. **Reset configuration:**
   ```bash
   curl -X POST http://localhost:3000/configure/reset
   ```

### 3. App Crashes or Freezes

**Symptoms:**
- Stremio crashes when opening catalogs
- App becomes unresponsive
- Force close required

**Solutions:**
1. **Clear Stremio cache:**
   - Go to Android Settings → Apps → Stremio → Storage
   - Tap "Clear Cache" (NOT "Clear Data")

2. **Restart Stremio completely:**
   - Force close Stremio in recent apps
   - Reopen Stremio

3. **Check memory usage in Termux:**
   ```bash
   free -h
   top
   ```

4. **Reduce result count in configuration:**
   - Open http://localhost:3000/configure
   - Set "Maximum Results" to 25 or lower

### 4. Slow Loading / Poor Performance

**Symptoms:**
- Very slow catalog loading
- Timeouts
- Poor responsiveness

**Solutions:**
1. **Enable caching** (if not already):
   ```bash
   curl -X POST http://localhost:3000/configure/api \
     -H "Content-Type: application/json" \
     -d '{"cacheTimeout": 600}'
   ```

2. **Reduce concurrent requests:**
   - Open fewer catalogs simultaneously
   - Wait for one catalog to load before opening another

3. **Check network speed:**
   ```bash
   curl -w "@-" -o /dev/null -s "https://nyaa.si" <<'EOF'
   time_total: %{time_total}
   EOF
   ```

4. **Use trusted uploaders only:**
   ```bash
   curl -X POST http://localhost:3000/configure/api \
     -H "Content-Type: application/json" \
     -d '{"trustedUploadersOnly": true}'
   ```

### 5. No Streams / Magnet Links Don't Work

**Symptoms:**
- "No streams found" when clicking on content
- Magnet links don't open in torrent client

**Solutions:**
1. **Test stream endpoint:**
   ```bash
   curl "http://localhost:3000/stream/anime/nyaa:test.json"
   ```

2. **Install a torrent client:**
   - Install a torrent app like µTorrent, BitTorrent, or Flud
   - Set it as default for magnet links

3. **Check magnet link format:**
   - Open browser and test a magnet link manually
   - Ensure it opens in your torrent client

### 6. Configuration Issues

**Symptoms:**
- Changes don't take effect
- Can't access configuration page
- Settings reset on restart

**Solutions:**
1. **Access configuration page:**
   ```bash
   # Open in Android browser
   http://localhost:3000/configure
   ```

2. **Test configuration API:**
   ```bash
   curl http://localhost:3000/configure/api
   ```

3. **Manual configuration update:**
   ```bash
   curl -X POST http://localhost:3000/configure/api \
     -H "Content-Type: application/json" \
     -d '{
       "enableNsfwFilter": true,
       "trustedUploadersOnly": false,
       "maxResults": 50,
       "defaultSort": "date",
       "preferredQuality": ["1080p", "720p"]
     }'
   ```

## 🔍 Diagnostic Commands

### Quick Health Check
```bash
curl http://localhost:3000/api/mobile-health
```

### Network Test
```bash
curl http://localhost:3000/api/network-test
```

### Detailed Diagnostic
```bash
curl http://localhost:3000/api/android-diagnostic
```

### Check Logs
```bash
# In Termux where server is running
# Look for error messages in the output
```

### Test All Endpoints
```bash
# Manifest
curl http://localhost:3000/manifest.json | head -5

# Catalog
curl "http://localhost:3000/catalog/anime/nyaa-anime-all.json" | head -10

# Health
curl http://localhost:3000/api/health

# Info
curl http://localhost:3000/api/info
```

## 📱 Device-Specific Solutions

### Low RAM Devices (<3GB)
- Set max results to 25 or lower
- Enable only essential filters
- Close other apps while using Stremio
- Use trusted uploaders only

### Older Android Versions (<8.0)
- Use simple search terms
- Avoid complex filters
- Clear cache frequently
- Restart addon server periodically

### Network Issues
- Use mobile data if WiFi is slow
- Try different DNS servers (8.8.8.8, 1.1.1.1)
- Disable VPN if experiencing issues
- Check firewall/parental controls

## 🛠️ Advanced Troubleshooting

### Enable Debug Logging
```bash
curl -X POST http://localhost:3000/configure/api \
  -H "Content-Type: application/json" \
  -d '{"enableDetailedLogging": true}'
```

### Check Server Resources
```bash
# Memory usage
free -h

# CPU usage
top -n 1

# Disk space
df -h

# Process info
ps aux | grep node
```

### Network Connectivity Test
```bash
# Test nyaa.si connectivity
ping -c 3 nyaa.si

# Test DNS resolution
nslookup nyaa.si

# Test HTTP access
curl -I https://nyaa.si
```

### Reset Everything
```bash
# Stop server (Ctrl+C in Termux)
# Clear cache
curl -X POST http://localhost:3000/api/cache/clear

# Reset configuration
curl -X POST http://localhost:3000/configure/reset

# Restart server
npm start
```

## 📞 Getting Help

If these solutions don't help:

1. **Check the logs:** Look for error messages in Termux output
2. **Test with simple queries:** Start with basic searches
3. **Try desktop version:** Test if the issue is Android-specific
4. **Check Android version:** Ensure compatibility with Stremio
5. **Report issues:** Include diagnostic output and error messages

### Useful Information to Include:
- Android version
- Stremio version
- Device model and RAM
- Error messages from Termux
- Output from diagnostic commands
- Network type (WiFi/mobile data)

### Diagnostic Collection Command:
```bash
echo "=== SukeNyaa Diagnostic Report ===" > diagnostic.txt
echo "Date: $(date)" >> diagnostic.txt
echo "Android Version: $(getprop ro.build.version.release)" >> diagnostic.txt
echo "Device: $(getprop ro.product.model)" >> diagnostic.txt
echo "" >> diagnostic.txt
echo "=== Server Health ===" >> diagnostic.txt
curl -s http://localhost:3000/api/mobile-health >> diagnostic.txt
echo "" >> diagnostic.txt
echo "=== Network Test ===" >> diagnostic.txt
curl -s http://localhost:3000/api/network-test >> diagnostic.txt
echo "" >> diagnostic.txt
echo "=== Configuration ===" >> diagnostic.txt
curl -s http://localhost:3000/configure/api >> diagnostic.txt
cat diagnostic.txt
```

This will create a comprehensive diagnostic report to help identify issues.