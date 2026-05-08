#!/bin/bash

# Kill any existing server on 3000
kill $(lsof -t -i :3000) 2>/dev/null || true

echo "Starting frontend server..."
npm --prefix frontend run dev > frontend.log 2>&1 &

echo "Waiting for server to be ready..."
until curl -s http://localhost:3000 > /dev/null; do
  sleep 1
done

echo "Running tests..."
pytest tests/test_sidebar_and_nodes.py

echo "Cleaning up..."
kill $(lsof -t -i :3000) 2>/dev/null || true
rm frontend.log
