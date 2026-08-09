@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d c:\Users\shaki\Desktop\meetpe\mobile-app-rider\android
call gradlew.bat assembleDebug
echo.
echo === RIDER APP BUILD COMPLETE ===
echo APK location: app\build\outputs\apk\debug\app-debug.apk
pause
