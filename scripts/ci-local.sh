#!/bin/bash

# Local CI Check Script
# Run this before pushing to validate your changes locally

set -e

echo "🔍 Running Local CI Checks..."
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILED=0

# 1. TypeScript Check
echo -e "\n${YELLOW}[1/4] TypeScript Check...${NC}"
if pnpm run typecheck 2>/dev/null; then
    echo -e "${GREEN}✓ TypeScript check passed${NC}"
else
    echo -e "${RED}✗ TypeScript check failed${NC}"
    FAILED=1
fi

# 2. Lint Check
echo -e "\n${YELLOW}[2/4] ESLint Check...${NC}"
if pnpm run lint 2>/dev/null; then
    echo -e "${GREEN}✓ Lint check passed${NC}"
else
    echo -e "${RED}✗ Lint check failed${NC}"
    echo -e "${YELLOW}  Run 'pnpm run lint:fix' to auto-fix${NC}"
    FAILED=1
fi

# 3. Format Check
echo -e "\n${YELLOW}[3/4] Prettier Format Check...${NC}"
if pnpm run format:check 2>/dev/null; then
    echo -e "${GREEN}✓ Format check passed${NC}"
else
    echo -e "${RED}✗ Format check failed${NC}"
    echo -e "${YELLOW}  Run 'pnpm run format' to auto-fix${NC}"
    FAILED=1
fi

# 4. Build Check
echo -e "\n${YELLOW}[4/4] Build Check...${NC}"
if pnpm run build 2>/dev/null; then
    echo -e "${GREEN}✓ Build check passed${NC}"
else
    echo -e "${RED}✗ Build check failed${NC}"
    FAILED=1
fi

# Optional: Run tests if --test flag is passed
if [[ "$1" == "--test" ]]; then
    echo -e "\n${YELLOW}[5/5] Running Tests...${NC}"
    if pnpm run test 2>/dev/null; then
        echo -e "${GREEN}✓ Tests passed${NC}"
    else
        echo -e "${RED}✗ Tests failed${NC}"
        FAILED=1
    fi
fi

# Summary
echo ""
echo "================================"
if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All checks passed! Safe to push.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Fix issues before pushing.${NC}"
    exit 1
fi
