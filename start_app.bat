@echo off
powershell -NoProfile -Command "if (Test-Path 'assets\logo.png') { $b = [IO.File]::ReadAllBytes('assets\logo.png'); $s = [Convert]::ToBase64String($b); [IO.File]::WriteAllText('assets\logo.js', 'window.ASSETS_LOGO_DATA = \"data:image/png;base64,' + $s + '\";`n', [System.Text.Encoding]::UTF8) }"
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
