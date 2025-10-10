@echo off
echo 멤버스 시스템 폴더 및 파일 생성 중...

REM 1. 컴포넌트 폴더 생성
mkdir "src\components\users" 2>nul

REM 2. 컴포넌트 파일 생성
echo. > "src\components\users\UserManagement.tsx"
echo. > "src\components\users\UserRegistrationModal.tsx"
echo. > "src\components\users\UserDetailModal.tsx"
echo. > "src\components\users\RoleManagement.tsx"
echo. > "src\components\users\TeamAssignment.tsx"

REM 3. 페이지 파일 생성 (admin 폴더는 이미 존재)
echo. > "src\pages\admin\user-management.tsx"

REM 4. API 폴더 및 파일 생성
mkdir "src\pages\api\users" 2>nul
echo. > "src\pages\api\users\create-user.ts"
echo. > "src\pages\api\users\update-user.ts"
echo. > "src\pages\api\users\get-users.ts"
echo. > "src\pages\api\users\delete-user.ts"
echo. > "src\pages\api\users\assign-role.ts"

REM 5. 타입 파일 생성 (types 폴더는 이미 존재)
echo. > "src\types\users.ts"

REM 6. 훅 파일 생성 (hooks 폴더는 이미 존재)
echo. > "src\hooks\useUsers.ts"

echo.
echo ✅ 멤버스 시스템 폴더 및 파일 생성 완료!
echo.
echo 생성된 폴더:
echo - src\components\users\
echo - src\pages\api\users\
echo.
echo 생성된 파일:
echo - src\components\users\UserManagement.tsx
echo - src\components\users\UserRegistrationModal.tsx
echo - src\components\users\UserDetailModal.tsx
echo - src\components\users\RoleManagement.tsx
echo - src\components\users\TeamAssignment.tsx
echo - src\pages\admin\user-management.tsx
echo - src\pages\api\users\create-user.ts
echo - src\pages\api\users\update-user.ts
echo - src\pages\api\users\get-users.ts
echo - src\pages\api\users\delete-user.ts
echo - src\pages\api\users\assign-role.ts
echo - src\types\users.ts
echo - src\hooks\useUsers.ts
echo.
pause
