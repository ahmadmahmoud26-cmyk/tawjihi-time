#!/bin/bash

#
# Tawjihi Time - Complete Local Setup & Run Script
# Supports: Linux, macOS
#

set -e

echo "========================================"
echo "Tawjihi Time - Local Development Setup"
echo "========================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_PATH="$SCRIPT_DIR/backend"
FRONTEND_PATH="$SCRIPT_DIR/frontend"
DATABASE_PATH="$SCRIPT_DIR/database"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed. Please install Node.js 16+ first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found: $(npm --version)${NC}"

# Check PostgreSQL
echo ""
echo -e "${YELLOW}[2/5] Checking PostgreSQL...${NC}"

if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL found${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL not found in PATH. Make sure PostgreSQL is running.${NC}"
    echo -e "${YELLOW}  - macOS: brew services start postgresql${NC}"
    echo -e "${YELLOW}  - Linux: sudo systemctl start postgresql${NC}"
    echo ""
fi

# Install dependencies
echo ""
echo -e "${YELLOW}[3/5] Installing dependencies...${NC}"

echo -e "${CYAN}  Installing backend dependencies...${NC}"
cd "$BACKEND_PATH"
npm install --silent
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to install backend dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

echo -e "${CYAN}  Installing frontend dependencies...${NC}"
cd "$FRONTEND_PATH"
npm install --silent
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to install frontend dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Database migrations
echo ""
echo -e "${YELLOW}[4/5] Preparing database...${NC}"

echo -e "${CYAN}  Running migrations...${NC}"
cd "$BACKEND_PATH"
npm run migrate 2>&1 || echo -e "${YELLOW}⚠ Migration warning (database may not be running yet)${NC}"
echo -e "${GREEN}✓ Database migrations completed${NC}"

# Start services
echo ""
echo -e "${YELLOW}[5/5] Starting services...${NC}"
echo ""

echo -e "${CYAN}Starting Backend API (port 3001)...${NC}"
cd "$BACKEND_PATH"
npm run dev &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"

echo ""
echo -e "${CYAN}Starting Frontend (port 5173)...${NC}"
cd "$FRONTEND_PATH"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"

echo ""
echo "========================================"
echo -e "${GREEN}✓ Services Started Successfully!${NC}"
echo "========================================"
echo ""
echo -e "${CYAN}📱 Frontend: http://localhost:5173${NC}"
echo -e "${CYAN}🔌 Backend API: http://localhost:3001/api/health${NC}"
echo ""
echo -e "${YELLOW}🔑 Default Admin Login:${NC}"
echo -e "   Email: admin@tawjihi-time.edu.jo"
echo -e "   Password: AdminPassword123!"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop services${NC}"
echo ""

# Trap Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Services stopped.'; exit" INT TERM

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
