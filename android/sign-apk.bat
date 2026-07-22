@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set BUILD_TOOLS=C:\Users\pooji\AppData\Local\Android\Sdk\build-tools\36.1.0

echo Step 1: Zipaligning APK...
"%BUILD_TOOLS%\zipalign.exe" -f -v 4 "app\build\outputs\apk\release\app-release-unsigned.apk" "app\build\outputs\apk\release\app-release-aligned.apk"

echo Step 2: Signing APK...
"%BUILD_TOOLS%\apksigner.bat" sign --ks ecoshare-release.keystore --ks-key-alias ecoshare --ks-pass pass:EcoShare2025 --key-pass pass:EcoShare2025 --out "app\build\outputs\apk\release\app-release-signed.apk" "app\build\outputs\apk\release\app-release-aligned.apk"

echo Step 3: Verifying signature...
"%BUILD_TOOLS%\apksigner.bat" verify "app\build\outputs\apk\release\app-release-signed.apk"

echo DONE - Signed APK ready!
