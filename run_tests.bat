@echo off
echo Starting frontend server...
start /B npm --prefix frontend run dev

echo Waiting for server to be ready on http://localhost:3000...
:wait
timeout /t 2 >nul
curl -s http://localhost:3000 >nul
if errorlevel 1 goto wait

echo Running tests...
pytest tests/test_sidebar_and_nodes.py

echo Cleaning up...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a
