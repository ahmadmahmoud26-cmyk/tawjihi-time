#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Tawjihi Time - Complete Local Setup & Run Script
.DESCRIPTION
    Initializes database, installs dependencies, and starts both backend and frontend
#>

param(
    [switch]$SkipDbCheck = $false,
    [switch]$SkipInstall = $false,
    [switch]$SkipMigrations = $false
)

$ErrorActionPreference = "Stop"
$WarningPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tawjihi Time - Local Development Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paths
$rootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $rootPath "backend"
$frontendPath = Join-Path $rootPath "frontend"
$databasePath = Join-Path $rootPath "database"

# Check prerequisites
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "✗ Node.js is not installed. Please install Node.js 16+ first." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js found: $(node --version)" -ForegroundColor Green

# Check npm
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "✗ npm is not installed." -ForegroundColor Red
    exit 1
}
Write-Host "✓ npm found: $(npm --version)" -ForegroundColor Green

# Check PostgreSQL
if (!$SkipDbCheck) {
    Write-Host ""
    Write-Host "[2/5] Checking PostgreSQL..." -ForegroundColor Yellow
    
    $psqlPath = (Get-Command psql -ErrorAction SilentlyContinue).Path
    if ($psqlPath) {
        Write-Host "✓ PostgreSQL found" -ForegroundColor Green
    } else {
        Write-Host "⚠ PostgreSQL not found in PATH. Make sure PostgreSQL is running." -ForegroundColor Yellow
        Write-Host "  - Windows: Start PostgreSQL service or run from installation directory" -ForegroundColor Yellow
        Write-Host "  - Linux/Mac: brew services start postgresql (or equivalent)" -ForegroundColor Yellow
        Write-Host ""
    }
}

# Install dependencies
Write-Host ""
Write-Host "[3/5] Installing dependencies..." -ForegroundColor Yellow

if (!$SkipInstall) {
    Write-Host "  Installing backend dependencies..." -ForegroundColor Cyan
    Push-Location $backendPath
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install backend dependencies" -ForegroundColor Red
        exit 1
    }
    Pop-Location
    Write-Host "✓ Backend dependencies installed" -ForegroundColor Green

    Write-Host "  Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location $frontendPath
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }
    Pop-Location
    Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⊘ Skipped (use -SkipInstall to repeat)" -ForegroundColor Cyan
}

# Database migrations
Write-Host ""
Write-Host "[4/5] Preparing database..." -ForegroundColor Yellow

if (!$SkipMigrations) {
    Write-Host "  Running migrations..." -ForegroundColor Cyan
    Push-Location $backendPath
    npm run migrate 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠ Migration warning (database may not be running yet)" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Database migrations completed" -ForegroundColor Green
    }
    Pop-Location
} else {
    Write-Host "⊘ Skipped (use -SkipMigrations to repeat)" -ForegroundColor Cyan
}

# Start services
Write-Host ""
Write-Host "[5/5] Starting services..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting Backend API (port 3001)..." -ForegroundColor Cyan
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev" -PassThru
Write-Host "✓ Backend started (PID: $($backendProcess.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "Starting Frontend (port 5173)..." -ForegroundColor Cyan
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -PassThru
Write-Host "✓ Frontend started (PID: $($frontendProcess.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Services Started Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔌 Backend API: http://localhost:3001/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔑 Default Admin Login:" -ForegroundColor Yellow
Write-Host "   Email: admin@tawjihi-time.edu.jo" -ForegroundColor Gray
Write-Host "   Password: AdminPassword123!" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C in either terminal to stop services" -ForegroundColor Yellow
Write-Host ""

