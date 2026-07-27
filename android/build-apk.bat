@echo off
SET JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
SET PATH=%JAVA_HOME%\bin;%PATH%
echo Using Java: %JAVA_HOME%
java -version
echo.
echo Building APK...
call gradlew.bat assembleDebug
echo.
echo Done! APK location:
dir /s /b app\build\outputs\apk\debug\*.apk 2>nul
