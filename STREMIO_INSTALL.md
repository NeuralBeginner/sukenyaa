# 📱 Stremio Installation URLs

## Main Installation URL
```
http://localhost:3000/manifest.json
```

## Alternative Local Network URLs
If you're accessing from another device on the same network:

### Find Your Local IP:
**On Android/Termux:**
```bash
# Method 1
ip route get 8.8.8.8 | awk '{print $7}'

# Method 2  
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Desktop:**
- Windows: `ipconfig`
- Mac/Linux: `ifconfig` or `ip addr`

### Then use:
```
http://[YOUR_LOCAL_IP]:3000/manifest.json
```

## Testing URLs

### Health Check:
```
http://localhost:3000/api/health
```

### Interactive Test Page:
```
http://localhost:3000/test
```

### Configuration Interface:
```
http://localhost:3000/configure
```

---
**Note**: Keep this server running while using Stremio with SukeNyaa addon.
