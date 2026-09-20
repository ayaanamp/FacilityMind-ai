#!/usr/bin/env bash
# FacilityMind AI All-In-One Build Script for Render / Cloud
set -o errexit

echo "=== 1. Installing Backend Python Dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== 2. Building Frontend Production SPA ==="
cd frontend
npm install
npm run build
cd ..

echo "=== 3. Build Completed Successfully ==="
