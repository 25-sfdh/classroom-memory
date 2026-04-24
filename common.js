// ── Supabase 前端直连 ──

const SUPABASE_URL = "https://emonrzvnfgqzlnsmewpy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uOKwXc5ZP7O3qkRMbOl8tA_sCvNm2z6";
const SUPABASE_TABLES = ["members", "messages", "news", "photos", "activities", "memories", "history"];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const STORAGE_BUCKET = "class-uploads";

// ── supabase-js 客户端（动态 CDN 导入，不依赖构建工具） ──

let _supabaseClient = null;

async function getSupabase() {
  if (_supabaseClient) return _supabaseClient;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabaseClient;
  } catch (e) {
    console.warn("supabase-js CDN 加载失败，使用 REST 备用模式", e.message);
    return null;
  }
}

// ── Supabase REST 备用（当 supabase-js 不可用时降级） ──

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
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// ── 数据读取：优先 supabase-js，降级 REST ──

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
      return { title: row.title, text: row.content, date: row.date || toDateStr(row.created_at), id: row.id, created_at: row.created_at };
    case "activities":
      return { tag: row.tag, title: row.title, text: row.content, image: row.image_url, id: row.id, created_at: row.created_at };
    case "memories":
      return { name: row.name, text: row.content, date: toDateStr(row.created_at), id: row.id, created_at: row.created_at };
    case "history":
      return { date: row.date, title: row.title, text: row.content, id: row.id, created_at: row.created_at };
    default:
      return row;
  }
}

async function fetchList(category) {
  if (!SUPABASE_TABLES.includes(category)) return [];
  try {
    const supabase = await getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from(category)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) return data.map(row => mapSupabaseRow(category, row));
      return [];
    }
  } catch (e) {
    console.warn("supabase-js 读取失败，尝试 REST:", e.message);
  }
  try {
    const data = await supabaseFetch(`${SUPABASE_URL}/rest/v1/${category}?select=*&order=created_at.desc`);
    if (data && data.length > 0) return data.map(row => mapSupabaseRow(category, row));
    return [];
  } catch (e) {
    console.warn("REST 读取也失败:", e.message);
    return [];
  }
}

// ── 新增数据：优先 supabase-js .insert().select()，降级 REST ──

async function createItem(category, data) {
  if (!SUPABASE_TABLES.includes(category)) return { ok: false };
  const body = buildSupabaseRow(category, data);
  try {
    const supabase = await getSupabase();
    if (supabase) {
      const { data: inserted, error } = await supabase
        .from(category)
        .insert(body)
        .select()
        .maybeSingle();
      if (error) throw error;
      return { ok: true, data: inserted || null };
    }
  } catch (e) {
    console.warn("supabase-js 写入失败，尝试 REST:", e.message);
  }
  const result = await supabaseFetch(`${SUPABASE_URL}/rest/v1/${category}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return { ok: true, data: result };
}

function buildSupabaseRow(category, data) {
  const now = new Date().toISOString();
  switch (category) {
    case "messages":
      return { name: data.name, content: data.text, created_at: now };
    case "members":
      return { name: data.name, role: data.role || "", bio: data.note || "", avatar_url: data.photo || "", created_at: now };
    case "news":
      return { title: data.title, date: data.date || toDateStr(now), content: data.text || "", created_at: now };
    case "photos":
      return { title: data.name, image_url: data.image || "", description: data.caption || "", created_at: now };
    case "activities":
      return { tag: data.tag, title: data.title, content: data.text || "", image_url: data.image || "", created_at: now };
    case "memories":
      return { name: data.name, content: data.text || "", created_at: now };
    case "history":
      return { date: data.date, title: data.title, content: data.text || "", created_at: now };
    default:
      return { ...data, created_at: now };
  }
}

async function updateItem(category, id, data) {
  return fetch(`${SUPABASE_URL}/rest/v1/${category}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  }).then(r => r.ok ? { ok: true } : r.text().then(t => { throw new Error(t); }));
}

async function deleteItem(category, id) {
  return fetch(`${SUPABASE_URL}/rest/v1/${category}?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    }
  }).then(r => r.ok ? { ok: true } : r.text().then(t => { throw new Error(t); }));
}

// ── Supabase Storage 图片上传 ──

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

// ── 工具函数 ──

const domCache = new Map();

function getCachedElement(id) {
  if (!domCache.has(id)) {
    domCache.set(id, document.getElementById(id));
  }
  return domCache.get(id);
}

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
