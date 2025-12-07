#!/bin/bash
# Build script for jsapdu-over-ip examples
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
EXAMPLES_DIR="$ROOT_DIR/examples"

echo "=== jsapdu-over-ip Examples Build Script ==="
echo "Root: $ROOT_DIR"

# Build main library
echo "=== Step 1: Building main library ==="
cd "$ROOT_DIR"
if [ ! -d "dist" ]; then
    npm run build
fi
npm pack
echo

# Build shared
echo "=== Step 2: Building examples/shared ==="
cd "$EXAMPLES_DIR/shared"
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build
npm pack
echo

# Build router
echo "=== Step 3: Building examples/router ==="
cd "$EXAMPLES_DIR/router"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk-amd64}"
./gradlew build -x test
echo

echo "=== Build Complete ==="
echo "✅ Main library built"
echo "✅ Shared package built"
echo "✅ Router built"
