# 🔧 Troubleshooting Guide - DESKTOP

## Common Issues and Quick Fixes

### 1. "Add-on couldn't be detected"
- ✅ **Check server is running**: Visit http://localhost:3000/api/health
- ✅ **Verify URL**: Ensure you're using `http://localhost:3000/manifest.json`
- ✅ **Restart server**: Stop and start the SukeNyaa server

### 2. Empty Catalog / No Content
- ✅ **Test connectivity**: Visit http://localhost:3000/test
- ✅ **Check network**: Run `curl -I https://nyaa.si`
- ✅ **Reset config**: Visit http://localhost:3000/configure and reset to defaults

### 3. Slow Performance
- ✅ **Reduce results**: Lower max results in configuration
- ✅ **Enable trusted only**: Filter to trusted uploaders only
- ✅ **Close other apps**: Free up memory on your device


### Desktop-Specific Issues

#### 4. Firewall blocking connections
- Add exception for port 3000
- Temporarily disable firewall to test

#### 5. Multiple Node.js versions
```bash
node --version  # Should be 16.0.0 or higher
npm --version
```
