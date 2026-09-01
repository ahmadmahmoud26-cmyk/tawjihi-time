#!/bin/bash
# Setup script for Tawjihi Time Project

set -e

echo "🚀 Tawjihi Time - Project Setup Script"
echo "========================================"
echo ""

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ from nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node -v) found"
echo ""

# Setup Backend
echo "📦 Setting up Backend..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "Backend dependencies already installed"
fi

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created backend/.env - please edit with your database credentials"
else
    echo "✅ Backend .env already exists"
fi

cd ..
echo ""

# Setup Frontend
echo "📦 Setting up Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "Frontend dependencies already installed"
fi

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created frontend/.env - please edit with your API URL"
else
    echo "✅ Frontend .env already exists"
fi

cd ..
echo ""

echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with PostgreSQL credentials"
echo "2. Edit frontend/.env with API URL"
echo "3. Run: cd database && node runMigrations.js"
echo "4. Run backend: cd backend && npm run dev"
echo "5. Run frontend (new terminal): cd frontend && npm run dev"
echo ""
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:5173"
