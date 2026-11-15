start "WebPart2 - npm run dev" cmd /k "cd /d D:\WebPart2 && npm run dev"

timeout /t 1 /nobreak >nul

start "my-app - npm run dev" cmd /k "cd /d D:\WebPart2\my-app && npm run dev"

exit