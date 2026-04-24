#!/bin/bash
set -e

# ═══════════════════════════════════════════════
#   高2022级15班回忆馆 - 云服务器一键部署脚本
#   适用系统: Ubuntu 22.04 / 24.04
#   以非 root 用户 (ubuntu) 运行
# ═══════════════════════════════════════════════

echo "========================================"
echo "  开始部署 高2022级15班回忆馆..."
echo "========================================"

# 1. 系统更新 + 安装依赖
echo "[1/7] 更新系统并安装 Python、Nginx..."
sudo apt update -y
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx

# 2. 创建项目目录
echo "[2/7] 创建项目目录..."
mkdir -p ~/classroom/uploads

# 3. 上传项目文件
echo "[3/7] 上传项目文件..."
echo ""
echo "  ⚠️  请先在本地电脑上，用以下命令上传文件："
echo ""
echo "  打开本地 cmd（Windows 上）或终端（Mac），在本地项目目录执行："
echo ""
echo "  scp -r * ubuntu@你的服务器IP:~/classroom/"
echo "  scp -r .env ubuntu@你的服务器IP:~/classroom/"
echo ""
read -p "  按回车键继续（文件已上传后）..." _
cd ~/classroom

# 4. 创建虚拟环境 + 装依赖
echo "[4/7] 创建 Python 虚拟环境..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 5. 配置环境变量
echo "[5/7] 配置环境变量..."
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
SECRET_KEY=这里改成随机字符串，至少32位
ACCESS_PASSWORD=152025
PORT=5000
ENVEOF
    echo "  .env 文件已创建，请修改 SECRET_KEY:"
    echo "    nano ~/classroom/.env"
fi

# 6. 配置 systemd 服务（开机自启）
echo "[6/7] 配置 systemd 服务..."
sudo tee /etc/systemd/system/classroom.service > /dev/null << 'UNIT'
[Unit]
Description=高2022级15班回忆馆
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/classroom
EnvironmentFile=/home/ubuntu/classroom/.env
ExecStart=/home/ubuntu/classroom/venv/bin/gunicorn -w 2 -b 127.0.0.1:5000 "app:create_app()"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable classroom
sudo systemctl start classroom
echo "  systemd 服务已启动！"

# 7. 配置 Nginx 反向代理
echo "[7/7] 配置 Nginx..."
sudo tee /etc/nginx/sites-available/classroom > /dev/null << 'NGINX'
server {
    listen 80;
    server_name 你的域名.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /home/ubuntu/classroom/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/classroom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "========================================"
echo "  ✅ 部署完成！"
echo "========================================"
echo ""
echo "  接下来请："
echo ""
echo "  1️⃣  修改 .env 中的 SECRET_KEY"
echo "      nano ~/classroom/.env"
echo "      然后: sudo systemctl restart classroom"
echo ""
echo "  2️⃣  修改 Nginx 的 server_name 为你的域名"
echo "      sudo nano /etc/nginx/sites-available/classroom"
echo "      然后: sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  3️⃣  配置 HTTPS（推荐）"
echo "      sudo certbot --nginx -d 你的域名.com"
echo ""
echo "  4️⃣  把域名解析到本服务器IP"
echo ""
echo "  服务管理命令："
echo "    sudo systemctl status classroom    # 查看状态"
echo "    sudo systemctl restart classroom   # 重启"
echo "    sudo journalctl -u classroom -f    # 查看日志"
echo ""
echo "========================================"
