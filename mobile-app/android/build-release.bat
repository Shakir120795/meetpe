@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d c:\Users\shaki\Desktop\meetpe\mobile-app\android

echo.
echo === CUSTOMER APP - RELEASE BUILD ===
echo.
echo Step 1: Generate signing key (skip if already done)
echo Run this ONCE: keytool -genkey -v -keystore now-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias now
echo.

call gradlew.bat bundleRelease

echo.
echo === BUILD COMPLETE ===
echo AAB location: app\build\outputs\bundle\release\app-release.aab
echo.
echo To sign: jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore now-release-key.jks app\build\outputs\bundle\release\app-release.aab now
pause
