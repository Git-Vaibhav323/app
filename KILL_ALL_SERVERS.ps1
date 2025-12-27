# Kill ALL Node.js processes (use with caution)

Write-Host "⚠️  WARNING: This will kill ALL Node.js processes!" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to cancel, or any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "Killing all Node.js processes..." -ForegroundColor Red

$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        Write-Host "  Killing PID: $($proc.Id) - Started: $($proc.StartTime)" -ForegroundColor White
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host ""
    Write-Host "✅ All Node.js processes killed" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No Node.js processes found" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Checking port 3002..." -ForegroundColor Cyan
$port3002 = netstat -ano | findstr :3002

if ($port3002) {
    Write-Host "⚠️  Port 3002 still in use:" -ForegroundColor Yellow
    $port3002
} else {
    Write-Host "✅ Port 3002 is free" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now start the server:" -ForegroundColor Cyan
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  npm run start:engage" -ForegroundColor Green
}

