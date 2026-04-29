const ACCESS_PASSWORD = "152025";
const ADMIN_PASSWORD = "rhj152025";
const ACCESS_STORAGE_KEY = "class15-access-granted";
const ADMIN_STORAGE_KEY = "class15-admin-mode";

const SUPABASE_URL = "https://emonrzvnfgqzlnsmewpy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtb25yenZuZmdxemxuc21ld3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjUwMTgsImV4cCI6MjA5MjYwMTAxOH0.x3ZEBN8aLldVfeXjoUMFCHnIy7oWXpp3wDmxBUGdfgw";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const STORAGE_BUCKET = "class-uploads";
const STORAGE_FOLDERS = {
  members: "members",
  photos: "photos",
  activities: "activities",
};

function getSupabase() {
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}

async function supabaseFetch(table, options = {}) {
  const { method = "GET", headers = {}, body, params = "" } = options;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    method,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.details || `操作失败 (${res.status})`);
  }
  if (method === "GET") return res.json();
  if (method === "HEAD") return res;
  const text = await res.text();
  try { return text ? JSON.parse(text) : { ok: true }; } catch { return { ok: true }; }
}

async function supabaseUpload(bucket, path, file) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.details || "文件上传失败");
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function fetchList(category) {
  try {
    const data = await supabaseFetch(category, { params: "?select=*&order=created_at.desc" });
    return data || [];
  } catch (e) {
    console.warn("Supabase 读取失败:", e.message);
    return [];
  }
}

async function createItem(category, data) {
  const hasFile = data._file instanceof File;
  if (hasFile) {
    const file = data._file;
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const folder = STORAGE_FOLDERS[category] || category;
    const field = data._field || (category === "members" ? "avatar_url" : "image");
    delete data._file;
    delete data._field;
    data[field] = await supabaseUpload(STORAGE_BUCKET, `${folder}/${fileName}`, file);
  }
  const result = await supabaseFetch(category, { method: "POST", body: data });
  return { ok: true, data: result };
}

async function updateItem(category, id, data) {
  const hasFile = data._file instanceof File;
  if (hasFile) {
    const file = data._file;
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const folder = STORAGE_FOLDERS[category] || category;
    const field = data._field || (category === "members" ? "avatar_url" : "image");
    delete data._file;
    delete data._field;
    data[field] = await supabaseUpload(STORAGE_BUCKET, `${folder}/${fileName}`, file);
  }
  await supabaseFetch(category, { method: "PATCH", params: `?id=eq.${id}`, body: data });
  return { ok: true };
}

async function deleteItem(category, id) {
  await supabaseFetch(category, { method: "DELETE", params: `?id=eq.${encodeURIComponent(id)}` });
  return { ok: true };
}

const domCache = new Map();

function getCachedElement(id) {
  if (!domCache.has(id)) domCache.set(id, document.getElementById(id));
  return domCache.get(id);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function getPublicImageUrl(value, bucket = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  const cleanPath = raw.replace(/^\/+/, "");
  const path = bucket && cleanPath.startsWith(`${bucket}/`)
    ? cleanPath.slice(bucket.length + 1)
    : cleanPath;

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket || "uploads"}/${path}`;
}

function imageFallbackMarkup(label = "图片") {
  return `<div class="image-fallback">${escapeHtml(label)}</div>`;
}

function imageMarkup(src, alt, bucket) {
  const url = getPublicImageUrl(src, bucket);
  if (!url) return imageFallbackMarkup(alt);
  const fallback = imageFallbackMarkup(alt).replace(/"/g, "&quot;");

  return `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}" loading="lazy" onerror="this.outerHTML='${fallback}'">`;
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

function canDeleteItem() {
  return isAdminMode();
}

function deleteActionMarkup(category, id, label = "删除") {
  if (!isAdminMode()) return "";
  return `<div class="inline-actions"><button class="button ghost danger" type="button" data-action="delete-item" data-category="${category}" data-id="${id}">${label}</button></div>`;
}

function showToast(message, type = "success", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  if (type !== "loading") {
    setTimeout(() => {
      toast.classList.remove("toast-visible");
      toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, duration);
  }
  return toast;
}

function hideToast(toast) {
  if (!toast) return;
  toast.classList.remove("toast-visible");
  toast.addEventListener("transitionend", () => toast.remove(), { once: true });
}

function getLoadingText(originalText) {
  if (originalText.includes("上传")) return "上传中...";
  if (originalText.includes("保存")) return "保存中...";
  return "提交中...";
}

async function withSubmitLoading(button, asyncFn) {
  const originalText = button.textContent;
  const originalDisabled = button.disabled;
  button.disabled = true;
  button.dataset.originalText = originalText;
  button.textContent = getLoadingText(originalText);
  button.classList.add("is-loading");
  try {
    return await asyncFn();
  } catch (e) {
    showToast(e.message || "操作失败，请重试", "error");
    throw e;
  } finally {
    button.disabled = originalDisabled;
    button.textContent = button.dataset.originalText || originalText;
    delete button.dataset.originalText;
    button.classList.remove("is-loading");
  }
}

function isAccessGranted() {
  return sessionStorage.getItem(ACCESS_STORAGE_KEY) === "yes";
}

function isAdminMode() {
  return sessionStorage.getItem(ADMIN_STORAGE_KEY) === "yes";
}

function setAdminMode(enabled) {
  sessionStorage.setItem(ADMIN_STORAGE_KEY, enabled ? "yes" : "no");
  document.body.classList.toggle("admin-mode", enabled);
  const toggle = getCachedElement("admin-toggle");
  if (toggle) toggle.textContent = enabled ? "退出管理员模式" : "管理员模式";
  document.dispatchEvent(new CustomEvent("adminmodechange", { detail: { enabled } }));
}

function setupPasswordGate() {
  const gate = document.getElementById("password-gate");
  const form = document.getElementById("password-form");
  const input = document.getElementById("password-input");
  const error = document.getElementById("password-error");
  if (!gate || !form || !input || !error) return;
  if (!isAccessGranted()) {
    gate.classList.add("is-visible");
    document.body.classList.add("locked");
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value === ACCESS_PASSWORD) {
      sessionStorage.setItem(ACCESS_STORAGE_KEY, "yes");
      gate.classList.remove("is-visible");
      document.body.classList.remove("locked");
      error.textContent = "";
      form.reset();
      return;
    }
    error.textContent = "密码不对，请再试一次。";
    input.select();
  });
}

function injectAdminTools() {
  if (document.getElementById("admin-toggle")) return;
  const tools = document.createElement("div");
  tools.className = "admin-tools";
  tools.innerHTML = `
    <div class="admin-status">
      <span class="admin-status-dot"></span>
      <span>
        <span class="admin-status-text">管理员已激活</span>
        <span class="admin-status-hint">删除和编辑功能已开启</span>
      </span>
    </div>
    <button id="admin-toggle" class="admin-toggle" type="button">管理员模式</button>
  `;
  document.body.appendChild(tools);
}

function setupAdminMode() {
  injectAdminTools();
  setAdminMode(isAdminMode());
  const toggle = getCachedElement("admin-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    if (isAdminMode()) { setAdminMode(false); return; }
    const input = window.prompt("请输入管理员密码");
    if (input === null) return;
    if (input === ADMIN_PASSWORD) { setAdminMode(true); return; }
    showToast("管理员密码不正确。", "error");
  });
}

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
      <p>${escapeHtml(post.text || post.content)}</p>
      <time>${escapeHtml(post.date || post.created_at)}</time>
      ${deleteActionMarkup(category, post.id)}
    </article>
  `).join("");
}

async function handleDeleteAction(category, id, rerender) {
  if (!isAdminMode()) { showToast("只有管理员可以删除内容。", "error"); return; }
  if (!window.confirm("确定删除这条内容？")) return;
  try {
    await deleteItem(category, id);
    showToast("删除成功", "success");
    await rerender();
  } catch (e) {
    showToast(e.message || "删除失败，请重试", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupPasswordGate();
  setupAdminMode();
  const header = document.querySelector(".site-header");
  if (header) {
    const toggleScrolled = () => header.classList.toggle("scrolled", window.scrollY > 20);
    toggleScrolled();
    window.addEventListener("scroll", toggleScrolled, { passive: true });
  }
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
