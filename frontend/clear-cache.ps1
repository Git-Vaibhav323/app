# PowerShell script to clear Metro cache
Write-Host "🧹 Clearing Metro cache..." -ForegroundColor Yellow

# Stop any running Metro processes
Write-Host "Stopping Metro processes..." -ForegroundColor Cyan
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*expo*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait a moment
Start-Sleep -Seconds 2

# Remove cache directories
Write-Host "Removing cache directories..." -ForegroundColor Cyan
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .metro -ErrorAction SilentlyContinue

Write-Host "✅ Cache cleared!" -ForegroundColor Green
Write-Host ""
Write-Host "Now run: expo start --clear" -ForegroundColor Yellow

