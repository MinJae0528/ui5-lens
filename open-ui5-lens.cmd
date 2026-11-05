@echo off
rem UI5 Lens 를 빌드하고 미리보기 서버를 띄운 뒤 브라우저를 엽니다. (창을 닫으면 서버가 종료됩니다)
cd /d "%~dp0"
if not exist "public\data\versions.json" (
  echo 데이터가 없습니다. 먼저 npm run fetch:api 와 npm run build:data 를 실행하세요.
  pause
  exit /b 1
)
call npm run app
