#!/bin/bash
# AEGIS Linux/Mac Environment Verification Script

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🛡️ Running AEGIS Local Environment Verification...${NC}"

has_errors=0

# 1. Check commands
echo -e "\n${BLUE}[1/4] Checking CLI dependencies...${NC}"
if command -v node >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Node.js is installed: $(node --version)${NC}"
else
    echo -e "  ${RED}❌ Node.js is NOT installed or not on path!${NC}"
    has_errors=1
fi

if command -v python3 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Python is installed: $(python3 --version)${NC}"
elif command -v python >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Python is installed: $(python --version)${NC}"
else
    echo -e "  ${RED}❌ Python is NOT installed or not on path!${NC}"
    has_errors=1
fi

# 2. Check Directory Structure
echo -e "\n${BLUE}[2/4] Checking folder structure...${NC}"
dirs=("apps/shopstream" "apps/backend" "apps/frontend" "deploy")
for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "  ${GREEN}✅ Directory '$dir' exists${NC}"
    else
        echo -e "  ${RED}❌ Directory '$dir' is missing!${NC}"
        has_errors=1
    fi
done

# 3. Check Key Files
echo -e "\n${BLUE}[3/4] Verifying critical files...${NC}"
files=(
    "apps/shopstream/package.json"
    "apps/shopstream/server.js"
    "apps/backend/requirements.txt"
    "apps/backend/main.py"
    "apps/backend/services/agent_service.py"
    "apps/frontend/package.json"
    "apps/frontend/src/App.jsx"
    "deploy/deploy-all.sh"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✅ File '$file' exists${NC}"
    else
        echo -e "  ${RED}❌ File '$file' is missing!${NC}"
        has_errors=1
    fi
done

# 4. Final Verdict
echo -e "\n${BLUE}[4/4] Final Verdict...${NC}"
if [ $has_errors -ne 0 ]; then
    echo -e "${RED}❌ Verification failed. Please resolve the errors highlighted above.${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 AEGIS environment verified successfully!${NC}"
    exit 0
fi
