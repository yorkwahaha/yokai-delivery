@echo off
chcp 65001 >nul
title 妖怪快遞社 - 關卡美術預覽總覽
echo ===================================================
echo   《妖怪快遞社》關卡美術預覽 (Stage 2 - Stage 6)
echo   正在開啟瀏覽器檢視：art\Preview_index.html ...
echo ===================================================
cd /d "%~dp0"
if exist "art\Preview_index.html" (
    start "" "art\Preview_index.html"
) else (
    echo [錯誤] 找不到檔案：art\Preview_index.html
    pause
)
