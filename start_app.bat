@echo off
title Dokan Eileen Watermark Tool
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start http://localhost:8000
    python -m http.server 8000
    exit /b
)
where npx >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start http://localhost:3000
    npx serve -l 3000 .
    exit /b
)
start index.html
