@echo off
chcp 65001 >nul
title 高2022级15班回忆馆 - Node.js 服务器
echo ========================================
echo    高2022级15班回忆馆 - 正在启动...
echo ========================================
echo.
echo  访问地址:
echo    http://localhost:5000
echo.
echo  访问密码: 152025
echo.
echo  前端部署: Netlify     后端部署: Render
echo  数据库:   Firebase Firestore
echo.
echo  ========================================
echo  按 Ctrl+C 可停止服务器
echo  ========================================
echo.

node server.js
pause
