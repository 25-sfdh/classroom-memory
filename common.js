// ── 部署配置 ──
// 本地开发时留空（同源），部署到 Netlify 后改为 Render 后端地址
const API_BASE = (function () {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "";
  }
  const apiUrl = localStorage.getItem("api_base_url");
  if (apiUrl) return apiUrl.replace(/\/+$/, "");
  return "https://YOUR_APP_NAME.onrender.com";
})();

// ── Supabase 前端直连（匿名 key，安全用于客户端） ──

const SUPABASE_URL = "https://emonrzvnfgqzlnsmewpy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uOKwXc5ZP7O3qkRMbOl8tA_sCvNm2z6";

async function supabaseFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...options.headers
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Supabase Storage 图片上传 ──

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const STORAGE_BUCKET = "class-uploads";

async function supabaseUpload(file, folder = "uploads") {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("仅支持 JPG/PNG/WebP 格式");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("图片大小不能超过 5MB");
  }

  const ext = file.name.split(".").pop().toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `${folder}/${fileName}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": file.type
    },
    body: file
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`图片上传失败 (${res.status}): ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filePath}`;
}

// ── 数据读取：优先 Supabase，失败后 API 兜底 ──

const SUPABASE_TABLES = ["members", "messages", "news", "photos"];

function toDateStr(iso) {
  return iso ? iso.split("T")[0] : iso;
}

function mapSupabaseRow(category, row) {
  switch (category) {
    case "messages":
      return { name: row.name, text: row.content, date: toDateStr(row.created_at), id: row.id, created_at: row.created_at };
    case "members":
      return { name: row.name, photo: row.avatar_url, note: row.bio, id: row.id, created_at: row.created_at };
    case "photos":
      return { name: row.title, image: row.image_url, caption: row.description, date: toDateStr(row.created_at), id: row.id, created_at: row.created_at };
    case "news":
      return { title: row.title, text: row.content, date: toDateStr(row.created_at), id: row.id, created_at: row.created_at };
    default:
      return row;
  }
}

async function fetchList(category) {
  if (SUPABASE_TABLES.includes(category)) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${category}?select=*&order=created_at.desc`;
      const data = await supabaseFetch(url);
      if (data && data.length > 0) {
        return data.map(row => mapSupabaseRow(category, row));
      }
      return [];
    } catch (e) {
      console.warn("Supabase 读取失败，使用后端 API 兜底", e.message);
    }
  }
  return api("GET", `/api/${category}`);
}

// ── 新增数据：优先写入 Supabase（所有 4 张表），失败后 API 兜底 ──

async function createItem(category, data) {
  if (SUPABASE_TABLES.includes(category)) {
    try {
      const body = buildSupabaseRow(category, data);
      await supabaseFetch(`${SUPABASE_URL}/rest/v1/${category}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      return { ok: true };
    } catch (e) {
      console.warn(`Supabase 写入 ${category} 失败，使用后端 API 兜底`, e.message);
    }
  }
  return api("POST", `/api/${category}`, data);
}

function buildSupabaseRow(category, data) {
  const now = new Date().toISOString();
  switch (category) {
    case "messages":
      return { name: data.name, content: data.text, created_at: now };
    case "members":
      return { name: data.name, role: data.role || "", bio: data.note || "", avatar_url: data.photo || "", created_at: now };
    case "news":
      return { title: data.title, content: data.text || "", created_at: now };
    case "photos":
      return { title: data.name, image_url: data.image || "", description: data.caption || "", created_at: now };
    default:
      return { ...data, created_at: now };
  }
}

async function updateItem(category, id, data) {
  return api("PUT", `/api/${category}/${id}`, data);
}

async function deleteItem(category, id) {
  return api("DELETE", `/api/${category}/${id}`);
}

let uploadedFile = null;
const domCache = new Map();

function getCachedElement(id) {
  if (!domCache.has(id)) {
    domCache.set(id, document.getElementById(id));
  }
  return domCache.get(id);
}

// ── 后端 API（密码验证、后台管理、上传） ──

async function api(method, path, body) {
  const opts = { method, headers: {}, credentials: "include" };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const url = API_BASE + path;
  const res = await fetch(url, opts);
  if (res.status === 401) {
    showPasswordGate();
    throw new Error("登录已过期，请重新输入密码");
  }
  return res.json();
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append("file", file);
  return api("POST", "/api/upload", fd);
}

async function uploadImageFromDataUrl(dataUrl, filename = "upload.jpg") {
  const blob = await fetch(dataUrl).then(r => r.blob());
  const file = new File([blob], filename, { type: "image/jpeg" });
  return uploadImage(file);
}

// ── 密码门禁 ──

let gateVisible = false;

async function checkAuth() {
  const data = await api("GET", "/api/check-auth");
  return data.authenticated === true;
}

function showPasswordGate() {
  const gate = getCachedElement("password-gate");
  const error = getCachedElement("password-error");
  if (gate && !gate.classList.contains("is-visible")) {
    gate.classList.add("is-visible");
    document.body.classList.add("locked");
    gateVisible = true;
    if (error) error.textContent = "";
  }
}

function hidePasswordGate() {
  const gate = getCachedElement("password-gate");
  if (gate) {
    gate.classList.remove("is-visible");
    document.body.classList.remove("locked");
    gateVisible = false;
  }
  const toggle = document.querySelector(".nav-toggle");
  if (toggle) toggle.style.display = "";
}

async function setupPasswordGate() {
  const gate = getCachedElement("password-gate");
  const form = getCachedElement("password-form");
  const input = getCachedElement("password-input");
  const error = getCachedElement("password-error");

  if (!gate || !form || !input || !error) return;

  const authenticated = await checkAuth();
  if (authenticated) {
    gate.classList.remove("is-visible");
    document.body.classList.remove("locked");
    return;
  }

  showPasswordGate();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("POST", "/api/login", { password: input.value });
      if (result.ok) {
        hidePasswordGate();
        error.textContent = "";
        form.reset();
        location.reload();
      }
    } catch {
      error.textContent = "密码不对，请再试一次。";
      input.select();
    }
  });
}

// ── 工具函数 ──

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      "\"": "&quot;", "'": "&#039;"
    };
    return entities[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function formatDate(value) {
  return String(value).replaceAll("-", ".");
}

function formatMonth(value) {
  return String(value).replace("-", ".");
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("load", () => {
        const maxWidth = 900;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      });
      image.addEventListener("error", reject);
      image.src = reader.result;
    });
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

// ── 通用渲染 ──

async function renderPostsFromApi(category, targetId, emptyText) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const posts = await fetchList(category);
  if (!posts.length) {
    target.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }
  target.innerHTML = posts.map((post) => `
    <article class="post-card">
      <strong>${escapeHtml(post.name)}</strong>
      <p>${escapeHtml(post.text)}</p>
      <time>${escapeHtml(post.date || post.created_at)}</time>
    </article>
  `).join("");
}

// ── 导航切换 ──

document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    }, { passive: true });
    siteNav.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }
});

// ── 初始化 ──

setupPasswordGate();
