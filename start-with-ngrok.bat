@echo off
chcp 65001 >nul
title 高2022级15班回忆馆 - 服务器 + ngrok公网映射
echo ========================================
echo    高2022级15班回忆馆 - 启动中...
echo ========================================
echo.
echo  [1/2] 启动 Flask 服务器...
start "Flask" cmd /c "python app.py"

timeout /t 3 /nobreak >nul

echo  [2/2] 启动 ngrok 公网映射...
echo  登录 https://dashboard.ngrok.com 获取你的 Authtoken
echo  首次使用请运行: ngrok config add-authtoken 你的token
echo.
start "ngrok" cmd /c "ngrok http 5000 --log=stdout"

echo.
echo  ========================================
echo  启动完成！查看 ngrok 公网地址:
echo  1. 打开 http://localhost:4040
echo  2. 复制 "Forwarding" 后面的 https://xxxx.ngrok-free.app
echo  3. 把该链接发给同学即可访问
echo.
echo  局域网地址: http://%COMPUTERNAME%:5000
echo  本地地址:   http://localhost:5000
echo  访问密码:   152025
echo  ========================================
echo.
pause
