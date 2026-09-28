@echo off
chcp 65001 >nul
title علامة مائية متحركة - خادم التشغيل المحلي
cls
echo ========================================================
echo         برنامج علامة مائية متحركة (توقيع تيك توك)
echo ========================================================
echo.
echo [1/3] الانتقال إلى مجلد المشروع...
cd /d "%~dp0"

echo [2/3] فحص بيئة بايثون (Python)...
set PYTHON_CMD=

where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=python
    goto FOUND_PYTHON
)

where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=py
    goto FOUND_PYTHON
)

echo.
echo [!] تنبيه: لم يتم العثور على Python على جهازك!
echo     لتشغيل الخادم المحلي وتجنب قيود الأمان لمتصفح الويب (file://):
echo.
echo     1. قم بتحميل بايثون مجانا من الموقع الرسمي:
echo        https://www.python.org/downloads/
echo     2. اثناء التثبيت، تأكد من تفعيل خيار:
echo        [X] Add Python to PATH
echo     3. بعد التثبيت، أعد تشغيل هذا الملف start.bat
echo.
echo يمكنك ايضا فتح index.html مباشرة واختيار ملف اللوجو يدويا عبر زر "اختيار اللوجو".
echo.
pause
exit /b 1

:FOUND_PYTHON
echo [+] تم العثور على %PYTHON_CMD% بنجاح!
echo [3/3] فتح المتصفح تلقائيا على الرابط: http://localhost:8000
start http://localhost:8000
echo.
echo ========================================================
echo الخادم المحلي يعمل الآن على: http://localhost:8000
echo (اضغط Ctrl+C في اي وقت لايقاف الخادم)
echo ========================================================
echo.
%PYTHON_CMD% -m http.server 8000
pause
