const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 5000;

// ── 环境变量 ──
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "152025";
const SECRET_KEY = process.env.SECRET_KEY || "class-memory-secret-key-change-me";
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
const CATEGORIES = ["members", "activities", "photos", "memories", "news", "history", "messages"];

// ── Firebase 初始化 ──
let db;
const DATA_FILE = path.join(__dirname, "data.json");

function loadLocalData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return []; }
}

function saveLocalData(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

// 种子数据
const SEED_DATA = [
  { category: "memories", data: '{"name":"班长","text":"最难忘的是毕业前最后一次大扫除，大家一边收拾教室，一边把黑板写满祝福。"}', createdAt: new Date().toISOString() },
  { category: "memories", data: '{"name":"语文课代表","text":"高三的早读声、同桌递来的草稿纸、月考后的互相安慰，都值得被记住。"}', createdAt: new Date().toISOString() },
  { category: "messages", data: '{"name":"老同学","text":"我现在在上海工作，十年聚会如果定在暑假，大概率可以参加。"}', createdAt: new Date().toISOString() },
  { category: "history", data: '{"date":"2022-09","title":"开学与军训","text":"第一次集合、第一次点名，班级故事从这里开始。"}', createdAt: new Date().toISOString() },
  { category: "history", data: '{"date":"2023-10","title":"运动会总分突破","text":"接力、跳高、长跑和后勤组一起撑起了那次高光时刻。"}', createdAt: new Date().toISOString() },
  { category: "history", data: '{"date":"2024-12","title":"最后一次元旦晚会","text":"节目、掌声和合唱让教室变成临时舞台。"}', createdAt: new Date().toISOString() },
  { category: "history", data: '{"date":"2025-06","title":"毕业合影","text":"照片定格了那天的阳光，也定格了每个人的高中模样。"}', createdAt: new Date().toISOString() },
  { category: "news", data: '{"date":"2026-05-01","title":"十年聚会意向征集","text":"请同学们在留言板留下所在城市和可参加时间，班委将汇总后确定地点。"}', createdAt: new Date().toISOString() },
  { category: "news", data: '{"date":"2026-04-20","title":"毕业照电子版整理中","text":"如果你手里有高清活动照片，可以发给资料组统一归档。"}', createdAt: new Date().toISOString() },
  { category: "news", data: '{"date":"2026-04-12","title":"班级通讯录更新","text":"请确认自己的邮箱、城市和常用联系方式，便于后续活动通知。"}', createdAt: new Date().toISOString() },
  { category: "activities", data: '{"tag":"运动会","title":"接力赛后的拥抱","text":"不只是名次，更是一起跑完、一起喊到嗓子沙哑的下午。","image":"https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80"}', createdAt: new Date().toISOString() },
  { category: "activities", data: '{"tag":"元旦晚会","title":"教室里的小舞台","text":"把课桌推到两边之后，整个教室都像临时搭起来的剧场。","image":"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80"}', createdAt: new Date().toISOString() },
  { category: "activities", data: '{"tag":"毕业旅行","title":"出发那天的晴天","text":"有人拍照，有人整理零食，车刚开动，笑声就已经坐满了整排座位。","image":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"}', createdAt: new Date().toISOString() },
  { category: "photos", data: '{"name":"高2022级15班","caption":"高2022级15班全班合影，属于大家的第一张首页主图。","image":"assets/class-photo.jpg"}', createdAt: new Date().toISOString() },
  { category: "photos", data: '{"name":"资料组","caption":"高2022级15班曾饭指南，全班同学升学去向纪念图。","image":"assets/class-destination-map.jpg"}', createdAt: new Date().toISOString() }
];

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log("[OK] Firebase Firestore 已连接");
} else {
  console.log("[!] 未设置 FIREBASE_SERVICE_ACCOUNT，使用 data.json 文件存储");
  if (!fs.existsSync(DATA_FILE)) {
    saveLocalData(SEED_DATA);
    console.log("[OK] 已创建 data.json 并写入种子数据");
  }
}

// ── 文件上传配置 ──
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(16).toString("hex") + ext);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  cb(null, ALLOWED_EXTENSIONS.includes(ext));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ── 中间件 ──
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: "lax" }
}));

// CORS：开发时允许 Netlify 前端访问
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.startsWith("http://localhost") || origin.includes("netlify.app"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── 静态文件（本地开发用） ──
app.use(express.static(__dirname));

// ── 认证中间件 ──
function loginRequired(req, res, next) {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: "请先输入访问密码" });
  }
  next();
}

// ── 认证 API ──

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (password === ACCESS_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(403).json({ error: "密码不对" });
});

app.get("/api/check-auth", (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ── 数据操作 ──

async function getItems(category) {
  if (db) {
    const snap = await db.collection("items")
      .where("category", "==", category)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map(doc => {
      const d = doc.data();
      return { ...JSON.parse(d.data), id: doc.id, created_at: d.createdAt };
    });
  }
  const all = loadLocalData();
  return all
    .filter(item => item.category === category)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(item => ({ ...JSON.parse(item.data), id: item.id, created_at: item.createdAt }));
}

async function addItem(category, data) {
  const payload = {
    category,
    data: JSON.stringify(data),
    createdAt: new Date().toISOString()
  };
  if (db) {
    const docRef = await db.collection("items").add(payload);
    return docRef.id;
  }
  const all = loadLocalData();
  payload.id = crypto.randomBytes(8).toString("hex");
  all.push(payload);
  saveLocalData(all);
  return payload.id;
}

async function updateItem(category, id, data) {
  if (db) {
    const docRef = db.collection("items").doc(id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().category !== category) return false;
    await docRef.update({ data: JSON.stringify(data) });
    return true;
  }
  const all = loadLocalData();
  const idx = all.findIndex(item => item.id === id && item.category === category);
  if (idx === -1) return false;
  all[idx].data = JSON.stringify(data);
  saveLocalData(all);
  return true;
}

async function deleteItem(category, id) {
  if (db) {
    const docRef = db.collection("items").doc(id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().category !== category) return false;
    await docRef.delete();
    return true;
  }
  const all = loadLocalData();
  const idx = all.findIndex(item => item.id === id && item.category === category);
  if (idx === -1) return false;
  all.splice(idx, 1);
  saveLocalData(all);
  return true;
}

// ── CRUD API ──

app.get("/api/:category", loginRequired, async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(404).json({ error: "unknown category" });
  }
  try {
    const items = await getItems(category);
    res.json(items);
  } catch (err) {
    console.error("getItems error:", err);
    res.status(500).json({ error: "服务器错误" });
  }
});

app.post("/api/:category", loginRequired, async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(404).json({ error: "unknown category" });
  }
  const data = req.body;
  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "无效的数据" });
  }
  try {
    await addItem(category, data);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("addItem error:", err);
    res.status(500).json({ error: "服务器错误" });
  }
});

app.put("/api/:category/:id", loginRequired, async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(404).json({ error: "unknown category" });
  }
  const data = req.body;
  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "无效的数据" });
  }
  try {
    const ok = await updateItem(category, id, data);
    if (!ok) return res.status(404).json({ error: "未找到该条目" });
    res.json({ ok: true });
  } catch (err) {
    console.error("updateItem error:", err);
    res.status(500).json({ error: "服务器错误" });
  }
});

app.delete("/api/:category/:id", loginRequired, async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(404).json({ error: "unknown category" });
  }
  try {
    const ok = await deleteItem(category, id);
    if (!ok) return res.status(404).json({ error: "未找到该条目" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteItem error:", err);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ── 种子数据 API ──

app.post("/api/seed", loginRequired, async (req, res) => {
  try {
    if (db) {
      const snap = await db.collection("items").limit(1).get();
      if (!snap.empty) return res.json({ ok: true, message: "已有数据" });
      for (const item of SEED_DATA) {
        await db.collection("items").add({
          category: item.category,
          data: item.data,
          createdAt: new Date().toISOString()
        });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("seed error:", err);
    res.status(500).json({ error: "种子数据写入失败" });
  }
});

// ── 文件上传 API ──

app.post("/api/upload", loginRequired, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "文件大小不能超过 10MB" });
      }
      return res.status(400).json({ error: "上传失败" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "未选择文件" });
    }
    res.status(201).json({ url: `uploads/${req.file.filename}` });
  });
});

// ── 本地开发：fallback 到 index.html ──

app.get("*", (req, res) => {
  const filePath = path.join(__dirname, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  const dirIndex = path.join(filePath, "index.html");
  if (fs.existsSync(dirIndex)) {
    return res.sendFile(dirIndex);
  }
  res.status(404).json({ error: "not found" });
});

// ── 启动 ──

app.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(56));
  console.log("  高2022级15班回忆馆 - Node.js 服务器已启动");
  console.log("=".repeat(56));
  console.log(`  本机访问:     http://localhost:${PORT}`);
  console.log(`  访问密码:     ${ACCESS_PASSWORD}`);
  console.log("-".repeat(56));
  console.log("  后端部署:     Render");
  console.log("  前端部署:     Netlify");
  console.log("  数据库:       Firebase Firestore");
  console.log("=".repeat(56));
  if (!db) {
    console.log("");
    console.log("  [本地模式] 数据存储在 data.json 文件中");
    console.log("  [部署到 Render] 需设置环境变量 FIREBASE_SERVICE_ACCOUNT");
    console.log("=".repeat(56));
  }
});
