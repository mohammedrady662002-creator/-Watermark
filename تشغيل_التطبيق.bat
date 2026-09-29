@echo off
chcp 65001 > nul
title تشغيل مولد العلامة المائية - دكان إيلين
echo ==========================================================
echo    جاري تشغيل التطبيق عبر خادم محلي لضمان أعلى أداء وأمان
echo ==========================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo تم العثور على Python، جاري تشغيل الخادم على المنفذ 8000...
    start http://localhost:8000
    python -m http.server 8000
    exit /b
)

where npx >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo تم العثور على Node.js، جاري تشغيل الخادم...
    start http://localhost:3000
    npx serve -l 3000 .
    exit /b
)

echo لم يتم العثور على Python أو Node.js، جاري فتح الملف في المتصفح...
start index.html
