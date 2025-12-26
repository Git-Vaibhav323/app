# Quick Migration Script for Skip On Rebuild
# Run this from the project root

Write-Host "🔄 Migrating to new Skip On implementation..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Redis
Write-Host "Step 1: Checking Redis..." -ForegroundColor Yellow
try {
    $redisTest = redis-cli ping 2>&1
    if ($redisTest -match "PONG") {
        Write-Host "✅ Redis is running" -ForegroundColor Green
    } else {
        Write-Host "❌ Redis is NOT running!" -ForegroundColor Red
        Write-Host "   Install Redis or start it first" -ForegroundColor Yellow
        Write-Host "   Docker: docker run -d -p 6379:6379 redis:latest" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Redis CLI not found. Install Redis first." -ForegroundColor Red
    exit 1
}

# Step 2: Install backend dependencies
Write-Host ""
Write-Host "Step 2: Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
Set-Location ..

# Step 3: Backup and replace service
Write-Host ""
Write-Host "Step 3: Migrating frontend service..." -ForegroundColor Yellow
Set-Location frontend/services

if (Test-Path "skipOnService.ts") {
    Copy-Item "skipOnService.ts" "skipOnService.old.ts" -Force
    Write-Host "✅ Backed up old service" -ForegroundColor Green
}

if (Test-Path "skipOnService.new.ts") {
    Remove-Item "skipOnService.ts" -ErrorAction SilentlyContinue
    Rename-Item "skipOnService.new.ts" "skipOnService.ts"
    Write-Host "✅ New service activated" -ForegroundColor Green
} else {
    Write-Host "⚠️ skipOnService.new.ts not found - service may already be migrated" -ForegroundColor Yellow
}

Set-Location ../..

# Step 4: Fix import in chat-on.tsx
Write-Host ""
Write-Host "Step 4: Fixing imports..." -ForegroundColor Yellow
$chatFile = "frontend/app/home/chat-on.tsx"
if (Test-Path $chatFile) {
    $content = Get-Content $chatFile -Raw
    $content = $content -replace "skipOnService\.new", "skipOnService"
    Set-Content $chatFile -Value $content -NoNewline
    Write-Host "✅ Fixed imports in chat-on.tsx" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Migration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start backend: cd backend && npm start" -ForegroundColor White
Write-Host "2. Start frontend: cd frontend && expo start --clear" -ForegroundColor White
Write-Host "3. Test with two browser tabs" -ForegroundColor White

