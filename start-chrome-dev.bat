@echo off
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
set IP_ADDRESS=211.21.232.69
set PORT=3000

%CHROME_PATH% ^
  --unsafely-treat-insecure-origin-as-secure=http://%IP_ADDRESS%:%PORT% ^
  --allow-insecure-localhost ^
  --disable-web-security ^
  --auto-open-devtools-for-tabs ^
  --user-data-dir="C:\chrome-dev-profile" ^
  --disable-site-isolation-trials ^
  --enable-experimental-web-platform-features