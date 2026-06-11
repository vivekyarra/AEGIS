# AEGIS Windows Environment Verification Script
Write-Host "🛡️ Running AEGIS Local Environment Verification..." -ForegroundColor Cyan

$hasErrors = $false

# 1. Check commands
Write-Host "`n[1/4] Checking CLI dependencies..." -ForegroundColor Blue
try {
    $nodeVer = node --version
    Write-Host "  ✅ Node.js is installed: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js is NOT installed or not on path!" -ForegroundColor Red
    $hasErrors = $true
}

try {
    $pythonVer = python --version 2>$null
    Write-Host "  ✅ Python is installed: $pythonVer" -ForegroundColor Green
} catch {
    try {
        $pythonVer = py --version 2>$null
        Write-Host "  ✅ Python (py) is installed: $pythonVer" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Python is NOT installed or not on path!" -ForegroundColor Red
        $hasErrors = $true
    }
}

# 2. Check Directory Structure
Write-Host "`n[2/4] Checking folder structure..." -ForegroundColor Blue
$dirs = @("apps/shopstream", "apps/backend", "apps/frontend", "deploy")
foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Write-Host "  ✅ Directory '$dir' exists" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Directory '$dir' is missing!" -ForegroundColor Red
        $hasErrors = $true
    }
}

# 3. Check Key Files
Write-Host "`n[3/4] Verifying critical files..." -ForegroundColor Blue
$files = @(
    "apps/shopstream/package.json",
    "apps/shopstream/server.js",
    "apps/backend/requirements.txt",
    "apps/backend/main.py",
    "apps/backend/services/agent_service.py",
    "apps/frontend/package.json",
    "apps/frontend/src/App.jsx",
    "deploy/deploy-all.sh"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✅ File '$file' exists" -ForegroundColor Green
    } else {
        Write-Host "  ❌ File '$file' is missing!" -ForegroundColor Red
        $hasErrors = $true
    }
}

# 4. Final Verdict
Write-Host "`n[4/4] Final Verdict..." -ForegroundColor Blue
if ($hasErrors) {
    Write-Host "❌ Verification failed. Please resolve the errors highlighted above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "🎉 AEGIS environment verified successfully!" -ForegroundColor Green
    exit 0
}
