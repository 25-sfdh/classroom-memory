import sqlite3
import os
import uuid
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.utils import secure_filename

import json as _json

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "152025-class-memory-secret-key")
app.config["UPLOAD_FOLDER"] = os.environ.get(
    "UPLOAD_FOLDER",
    os.path.join(app.static_folder, "uploads")
)
app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_CONTENT_LENGTH", 10)) * 1024 * 1024
ACCESS_PASSWORD = os.environ.get("ACCESS_PASSWORD", "152025")
DB_PATH = os.environ.get("DB_PATH", os.path.join(app.static_folder, "classroom.db"))

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
CATEGORIES = {"members", "activities", "photos", "memories", "news", "history", "messages"}

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
        """)

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("authenticated"):
            return jsonify({"error": "请先输入访问密码"}), 401
        return f(*args, **kwargs)
    return decorated

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

init_db()

# ── 认证 ──

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    if data.get("password") == ACCESS_PASSWORD:
        session["authenticated"] = True
        session.permanent = True
        return jsonify({"ok": True})
    return jsonify({"error": "密码不对"}), 403

@app.route("/api/check-auth")
def api_check_auth():
    return jsonify({"authenticated": session.get("authenticated", False)})

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})

# ── 通用 CRUD ──

@app.route("/api/<category>")
@login_required
def api_list(category):
    if category not in CATEGORIES:
        return jsonify({"error": "unknown category"}), 404
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, data, created_at FROM items WHERE category=? ORDER BY id DESC",
            (category,)
        ).fetchall()
    items = []
    for row in rows:
        item = _json.loads(row["data"])
        item["id"] = row["id"]
        item["created_at"] = row["created_at"]
        items.append(item)
    return jsonify(items)

@app.route("/api/<category>", methods=["POST"])
@login_required
def api_create(category):
    if category not in CATEGORIES:
        return jsonify({"error": "unknown category"}), 404
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "无效的 JSON"}), 400
    with get_db() as conn:
        conn.execute(
            "INSERT INTO items (category, data) VALUES (?, ?)",
            (category, _json.dumps(data, ensure_ascii=False))
        )
    return jsonify({"ok": True}), 201

@app.route("/api/<category>/<int:item_id>", methods=["PUT"])
@login_required
def api_update(category, item_id):
    if category not in CATEGORIES:
        return jsonify({"error": "unknown category"}), 404
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "无效的 JSON"}), 400
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE items SET data=? WHERE id=? AND category=?",
            (_json.dumps(data, ensure_ascii=False), item_id, category)
        )
        if cur.rowcount == 0:
            return jsonify({"error": "未找到该条目"}), 404
    return jsonify({"ok": True})

@app.route("/api/<category>/<int:item_id>", methods=["DELETE"])
@login_required
def api_delete(category, item_id):
    if category not in CATEGORIES:
        return jsonify({"error": "unknown category"}), 404
    with get_db() as conn:
        cur = conn.execute(
            "DELETE FROM items WHERE id=? AND category=?",
            (item_id, category)
        )
        if cur.rowcount == 0:
            return jsonify({"error": "未找到该条目"}), 404
    return jsonify({"ok": True})

# ── 文件上传 ──

@app.route("/api/upload", methods=["POST"])
@login_required
def api_upload():
    if "file" not in request.files:
        return jsonify({"error": "未选择文件"}), 400
    file = request.files["file"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({"error": "不支持的文件类型，仅允许 jpg/png/gif/webp"}), 400
    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
    return jsonify({"url": f"uploads/{filename}"}), 201

# ── 默认种子数据 ──

@app.route("/api/seed", methods=["POST"])
def api_seed():
    if not session.get("authenticated"):
        return jsonify({"error": "请先登录"}), 401
    with get_db() as conn:
        for category in CATEGORIES:
            count = conn.execute("SELECT COUNT(*) FROM items WHERE category=?", (category,)).fetchone()[0]
            if count > 0:
                continue
            default_data = get_defaults(category)
            for item in default_data:
                conn.execute(
                    "INSERT INTO items (category, data) VALUES (?, ?)",
                    (category, _json.dumps(item, ensure_ascii=False))
                )
    return jsonify({"ok": True})

def get_defaults(category):
    defaults = {
        "memories": [
            {"name": "班长", "text": "最难忘的是毕业前最后一次大扫除，大家一边收拾教室，一边把黑板写满祝福。"},
            {"name": "语文课代表", "text": "高三的早读声、同桌递来的草稿纸、月考后的互相安慰，都值得被记住。"}
        ],
        "messages": [
            {"name": "老同学", "text": "我现在在上海工作，十年聚会如果定在暑假，大概率可以参加。"}
        ],
        "history": [
            {"date": "2022-09", "title": "开学与军训", "text": "第一次集合、第一次点名，班级故事从这里开始。"},
            {"date": "2023-10", "title": "运动会总分突破", "text": "接力、跳高、长跑和后勤组一起撑起了那次高光时刻。"},
            {"date": "2024-12", "title": "最后一次元旦晚会", "text": "节目、掌声和合唱让教室变成临时舞台。"},
            {"date": "2025-06", "title": "毕业合影", "text": "照片定格了那天的阳光，也定格了每个人的高中模样。"}
        ],
        "news": [
            {"date": "2026-05-01", "title": "十年聚会意向征集", "text": "请同学们在留言板留下所在城市和可参加时间，班委将汇总后确定地点。"},
            {"date": "2026-04-20", "title": "毕业照电子版整理中", "text": "如果你手里有高清活动照片，可以发给资料组统一归档。"},
            {"date": "2026-04-12", "title": "班级通讯录更新", "text": "请确认自己的邮箱、城市和常用联系方式，便于后续活动通知。"}
        ],
        "activities": [
            {"tag": "运动会", "title": "接力赛后的拥抱", "text": "不只是名次，更是一起跑完、一起喊到嗓子沙哑的下午。", "image": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80"},
            {"tag": "元旦晚会", "title": "教室里的小舞台", "text": "把课桌推到两边之后，整个教室都像临时搭起来的剧场。", "image": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80"},
            {"tag": "毕业旅行", "title": "出发那天的晴天", "text": "有人拍照，有人整理零食，车刚开动，笑声就已经坐满了整排座位。", "image": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"}
        ],
        "photos": [
            {"name": "高2022级15班", "caption": "高2022级15班全班合影，属于大家的第一张首页主图。", "image": "assets/class-photo.jpg"},
            {"name": "资料组", "caption": "高2022级15班曾饭指南，全班同学升学去向纪念图。", "image": "assets/class-destination-map.jpg"}
        ]
    }
    return defaults.get(category, [])

# ── 静态文件 ──

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_files(path):
    if path.startswith("api/"):
        return jsonify({"error": "not found"}), 404
    file_path = os.path.join(app.static_folder, path)
    if os.path.isdir(file_path):
        index_path = os.path.join(file_path, "index.html")
        if os.path.isfile(index_path):
            return send_from_directory(file_path, "index.html")
    try:
        return send_from_directory(app.static_folder, path)
    except:
        return jsonify({"error": "not found"}), 404

def seed_if_empty():
    with get_db() as conn:
        for category in CATEGORIES:
            count = conn.execute("SELECT COUNT(*) FROM items WHERE category=?", (category,)).fetchone()[0]
            if count > 0:
                continue
            default_data = get_defaults(category)
            for item in default_data:
                conn.execute(
                    "INSERT INTO items (category, data) VALUES (?, ?)",
                    (category, _json.dumps(item, ensure_ascii=False))
                )
                print(f"  [OK] 已填充 {category} 默认数据 ({len(default_data)} 条)")

def create_app():
    return app

if __name__ == "__main__":
    seed_if_empty()
    port = int(os.environ.get("PORT", 5000))
    print("=" * 56)
    print("  高2022级15班回忆馆 - 服务器已启动")
    print("=" * 56)
    print(f"  本机访问:     http://localhost:{port}")
    print(f"  访问密码:     {ACCESS_PASSWORD}")
    print("-" * 56)
    print("  生产环境部署: 使用 gunicorn (见 deploy.sh)")
    print("=" * 56)
    print("  Ctrl+C 停止服务器")
    print("=" * 56)
    app.run(host="0.0.0.0", port=port, debug=False)
