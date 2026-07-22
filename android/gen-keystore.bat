@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v -keystore ecoshare-release.keystore -alias ecoshare -keyalg RSA -keysize 2048 -validity 10000 -storepass EcoShare2025 -keypass EcoShare2025 -dname "CN=EcoShare, OU=Mobile, O=EcoShare App, L=India, ST=India, C=IN"
echo DONE
