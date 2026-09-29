@echo off
chcp 65001 > nul
title تشغيل أداة العلامة المائية - دكان إيلين
echo ================================================================
echo      جاري مزامنة اللوجو من مجلد assets وتشغيل التطبيق
echo ================================================================
echo.

rem تحويل أي لوجو جديد يضعه المستخدم في assets\logo.png تلقائياً إلى Data URL لضمان عدم ظهور أي خطأ أمان
powershell -NoProfile -Command "if (Test-Path 'assets\logo.png') { try { $bytes = [IO.File]::ReadAllBytes('assets\logo.png'); $b64 = [Convert]::ToBase64String($bytes); [IO.File]::WriteAllText('assets\logo.js', 'window.ASSETS_LOGO_DATA = \"data:image/png;base64,' + $b64 + '\";`n', [System.Text.Encoding]::UTF8); Write-Host ' [OK] تم تحديث وقراءة اللوجو من assets\logo.png بنجاح تام.' -ForegroundColor Green } catch { Write-Host 'تنبيه: تعذر تحديث assets\logo.js' -ForegroundColor Yellow } }"

echo.
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo  [OK] تم تشغيل الخادم المحلي السريع عبر Python على المنفذ 8000
    start http://localhost:8000
    python -m http.server 8000
    exit /b
)

where npx >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo  [OK] تم تشغيل الخادم المحلي عبر Node.js على المنفذ 3000
    start http://localhost:3000
    npx serve -l 3000 .
    exit /b
)

echo  [OK] جاري فتح التطبيق في المتصفح الافتراضي...
start index.html
