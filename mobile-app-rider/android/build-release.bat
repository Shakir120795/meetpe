@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d c:\Users\shaki\Desktop\meetpe\mobile-app-rider\android

echo.
echo === RIDER APP - RELEASE BUILD ===
echo.

call gradlew.bat bundleRelease

echo.
echo === BUILD COMPLETE ===
echo AAB location: app\build\outputs\bundle\release\app-release.aab
pause
