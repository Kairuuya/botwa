#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Starting Bot Installation Process ===${NC}\n"

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[Error] Node.js is not installed. Please install Node.js v22 or higher and try again.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1 | sed 's/v//')

if [ "$NODE_MAJOR_VERSION" -lt 22 ]; then
    echo -e "${RED}[Error] Node.js version is ${NODE_VERSION}. Node.js v22 or higher is required.${NC}"
    exit 1
else
    echo -e "${GREEN}[OK]${NC} Node.js is installed: ${NODE_VERSION}"
fi

# 2. Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing pnpm globally...${NC}"
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install pnpm. Please install it manually.${NC}"
        exit 1
    fi
fi
PNPM_VERSION=$(pnpm -v)
echo -e "${GREEN}[OK]${NC} pnpm is installed: v${PNPM_VERSION}"

# 3. Install Dependencies
echo -e "\n${YELLOW}Installing dependencies using pnpm...${NC}"
pnpm install

# 4. Check .env file
echo -e "\n${YELLOW}Checking .env file...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}.env file not found.${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}[OK]${NC} .env file successfully created from .env.example. Don't forget to fill in the configurations!"
    else
        echo -e "${YELLOW}[!]${NC} .env.example file not found. Please create a .env file manually and set up your database configuration."
    fi
else
    echo -e "${GREEN}[OK]${NC} .env file already exists."
fi

# 5. Generate Prisma Client
echo -e "\n${YELLOW}Setting up Prisma Client...${NC}"
pnpm prisma generate

# 6. Setup Database (Optional)
echo -e "\n${YELLOW}Do you want to sync the database schema now? (y/n)${NC}"
read -p ">> " sync_db
if [[ "$sync_db" =~ ^[Yy]$ ]]; then
    pnpm prisma db push
    echo -e "${GREEN}[OK]${NC} Database synchronization complete.${NC}"
else
    echo -e "${YELLOW}[Skip]${NC} Database synchronization skipped."
fi

# Done
echo -e "\n${GREEN}=== Installation Complete! ===${NC}"
echo -e "To run the bot in development mode, run:"
echo -e "  ${YELLOW}pnpm dev${NC}"
echo -e "To build and run in production mode:"
echo -e "  ${YELLOW}pnpm build && pnpm start${NC}"

