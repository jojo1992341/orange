@echo off
rem ---------------------------------------------------------------------------
rem  Compilation de Ganymede (mode edition) pour Windows.
rem  Prerequis, une seule fois :
rem    - Node.js 24 ou plus recent  (https://nodejs.org)
rem    - Rust stable + Visual Studio Build Tools "Desktop development with C++"
rem      (https://rustup.rs)
rem  Ensuite : double-cliquez sur ce fichier. Le resultat se trouve dans
rem    src-tauri\target\release\ganymede.exe            (application portable)
rem    src-tauri\target\release\bundle\nsis\*.exe       (installateur)
rem ---------------------------------------------------------------------------
setlocal enabledelayedexpansion
cd /d "%~dp0.."

echo.
echo == Verification des outils ==
where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js est introuvable. Installez Node.js 24+ puis relancez.
  pause
  exit /b 1
)
where rustc >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Rust est introuvable. Installez rustup ^(https://rustup.rs^) puis relancez.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo Node.js %%v
for /f "tokens=*" %%v in ('rustc --version') do echo %%v

echo.
echo == Valeurs de compilation ==
rem Ces variables sont lues a la compilation (env! en Rust). Les valeurs par defaut
rem permettent de compiler hors du projet officiel ; remplacez-les si besoin.
if "%GANYMEDE_WEBSITE%"=="" set "GANYMEDE_WEBSITE=https://ganymede-dofus.com"
if "%GANYMEDE_API%"=="" set "GANYMEDE_API=https://ganymede-app.com/api"
if "%GANYMEDE_API_KEY%"=="" set "GANYMEDE_API_KEY=personal-build"
if "%GANYMEDE_CLIENT_ID%"=="" set "GANYMEDE_CLIENT_ID=personal-build"
if "%SENTRY_DSN%"=="" set "SENTRY_DSN=https://00000000000000000000000000000000@o0.ingest.sentry.io/0"
echo GANYMEDE_API=%GANYMEDE_API%

echo.
echo == Installation des dependances ==
call corepack enable >nul 2>nul
call pnpm i --frozen-lockfile
if errorlevel 1 (
  echo [ERREUR] pnpm i a echoue.
  pause
  exit /b 1
)

echo.
echo == Verification du code ==
call pnpm typecheck
if errorlevel 1 (
  echo [ERREUR] Le typecheck TypeScript a echoue.
  pause
  exit /b 1
)
call pnpm test

echo.
echo == Compilation (peut prendre 10 a 20 minutes) ==
call pnpm tauri build --config scripts/build-windows-config.json
if errorlevel 1 (
  echo [ERREUR] La compilation Tauri a echoue.
  pause
  exit /b 1
)

echo.
echo == Termine ==
echo Application portable : src-tauri\target\release\ganymede.exe
echo Installateur          : src-tauri\target\release\bundle\nsis\
start "" "src-tauri\target\release"
pause
