@echo off
REM Cursor Chat Sync - Build Script for Windows
REM This script builds all components of the system

setlocal enabledelayedexpansion

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 20+ first.
    exit /b 1
)

echo [INFO] Node.js version:
node -v
echo [INFO] Starting build process...

REM Parse command line arguments
set BUILD_BACKEND=1
set BUILD_ADMIN=1
set BUILD_EXTENSION=1
set INSTALL_DEPS=0
set CLEAN_BUILD=0

:parse_args
if "%~1"=="" goto :end_parse
if "%~1"=="--backend-only" (
    set BUILD_ADMIN=0
    set BUILD_EXTENSION=0
    shift
    goto :parse_args
)
if "%~1"=="--admin-only" (
    set BUILD_BACKEND=0
    set BUILD_EXTENSION=0
    shift
    goto :parse_args
)
if "%~1"=="--extension-only" (
    set BUILD_BACKEND=0
    set BUILD_ADMIN=0
    shift
    goto :parse_args
)
if "%~1"=="--install" (
    set INSTALL_DEPS=1
    shift
    goto :parse_args
)
if "%~1"=="--clean" (
    set CLEAN_BUILD=1
    shift
    goto :parse_args
)
if "%~1"=="--help" (
    echo Usage: build.bat [options]
    echo.
    echo Options:
    echo   --backend-only    Build only the backend
    echo   --admin-only     Build only the admin UI
    echo   --extension-only Build only the extension
    echo   --install        Install dependencies before building
    echo   --clean          Clean build (remove node_modules and dist)
    echo   --help           Show this help message
    exit /b 0
)
echo [ERROR] Unknown option: %~1
echo Use --help for usage information
exit /b 1

:end_parse

REM Clean build if requested
if %CLEAN_BUILD%==1 (
    echo [INFO] Cleaning build artifacts...
    if %BUILD_BACKEND%==1 (
        echo [INFO] Cleaning backend...
        if exist backend\dist rmdir /s /q backend\dist
        if exist backend\node_modules rmdir /s /q backend\node_modules
    )
    if %BUILD_ADMIN%==1 (
        echo [INFO] Cleaning admin UI...
        if exist admin-ui\dist rmdir /s /q admin-ui\dist
        if exist admin-ui\node_modules rmdir /s /q admin-ui\node_modules
    )
    if %BUILD_EXTENSION%==1 (
        echo [INFO] Cleaning extension...
        if exist extension\out rmdir /s /q extension\out
        if exist extension\node_modules rmdir /s /q extension\node_modules
    )
)

REM Install dependencies if requested
if %INSTALL_DEPS%==1 (
    echo [INFO] Installing dependencies...
    if %BUILD_BACKEND%==1 (
        echo [INFO] Installing backend dependencies...
        cd backend
        if not exist node_modules (
            call npm install
            if errorlevel 1 (
                echo [ERROR] Backend dependency installation failed!
                exit /b 1
            )
        ) else (
            echo [WARN] Backend node_modules exists, skipping install. Use --clean to force reinstall.
        )
        cd ..
    )
    
    if %BUILD_ADMIN%==1 (
        echo [INFO] Installing admin UI dependencies...
        cd admin-ui
        if not exist node_modules (
            call npm install
            if errorlevel 1 (
                echo [ERROR] Admin UI dependency installation failed!
                exit /b 1
            )
        ) else (
            echo [WARN] Admin UI node_modules exists, skipping install. Use --clean to force reinstall.
        )
        cd ..
    )
    
    if %BUILD_EXTENSION%==1 (
        echo [INFO] Installing extension dependencies...
        cd extension
        if not exist node_modules (
            call npm install
            if errorlevel 1 (
                echo [ERROR] Extension dependency installation failed!
                exit /b 1
            )
        ) else (
            echo [WARN] Extension node_modules exists, skipping install. Use --clean to force reinstall.
        )
        cd ..
    )
)

REM Build backend
if %BUILD_BACKEND%==1 (
    echo [INFO] Building backend...
    cd backend
    if not exist node_modules (
        echo [ERROR] Backend dependencies not installed. Run with --install flag.
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Backend build failed!
        exit /b 1
    )
    echo [INFO] Backend build successful!
    cd ..
)

REM Build admin UI
if %BUILD_ADMIN%==1 (
    echo [INFO] Building admin UI...
    cd admin-ui
    if not exist node_modules (
        echo [ERROR] Admin UI dependencies not installed. Run with --install flag.
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Admin UI build failed!
        exit /b 1
    )
    echo [INFO] Admin UI build successful!
    cd ..
)

REM Build extension
if %BUILD_EXTENSION%==1 (
    echo [INFO] Building extension...
    cd extension
    if not exist node_modules (
        echo [ERROR] Extension dependencies not installed. Run with --install flag.
        exit /b 1
    )
    call npm run compile
    if errorlevel 1 (
        echo [ERROR] Extension build failed!
        exit /b 1
    )
    echo [INFO] Extension build successful!
    cd ..
)

echo [INFO] Build completed successfully!
echo [INFO] All requested components have been built.
