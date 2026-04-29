const ACCESS_PASSWORD = "152025";
const ADMIN_PASSWORD = "rhj152025";
const ACCESS_STORAGE_KEY = "class15-access-granted";
const ADMIN_STORAGE_KEY = "class15-admin-mode";
const PB_AUTH_KEY = "class15-pb-token";

const PB_URL = "http://127.0.0.1:8090";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function pbFileUrl(collection, recordId, filename) {
  if (!filename) return "";
  return `${PB_URL}/api/files/${collection}/${recordId}/${filename}`;
}

async function pbAuth() {
  const cached = sessionStorage.getItem(PB_AUTH_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.expires > Date.now()) return parsed.token;
    } catch {}
  }
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: "admin@class15.com", password: "rhj152025" }),
  });
  if (!res.ok) throw new Error("PocketBase 管理员认证失败");
  const data = await res.json();
  sessionStorage.setItem(PB_AUTH_KEY, JSON.stringify({
    token: data.token,
    expires: Date.now() + 3600000,
  }));
  return data.token;
}

function toDateStr(iso) {
  return iso ? iso.split("T")[0] : iso;
}

function mapPbRecord(category, record) {
  const base = { id: record.id, created_at: record.created_at };
  switch (category) {
    case "messages":
      return { ...base, name: record.name, text: record.content, date: toDateStr(record.created_at) };
    case "members":
      return {
        ...base, name: record.name,
        photo: pbFileUrl("members", record.id, record.avatar) || "",
        note: record.bio || "",
        role: record.role || "",
      };
    case "photos":
      return {
        ...base, name: record.title,
        image: pbFileUrl("photos", record.id, record.image) || record.source_url || "",
        caption: record.description || "",
        date: toDateStr(record.created_at),
      };
    case "news":
      return { ...base, title: record.title, text: record.content || "", date: record.date || toDateStr(record.created_at) };
    case "activities":
      return {
        ...base, tag: record.tag || "", title: record.title, text: record.content || "",
        image: pbFileUrl("activities", record.id, record.image) || record.source_url || "",
      };
    case "memories":
      return { ...base, name: record.name || "", text: record.content, date: toDateStr(record.created_at) };
    case "history":
      return { ...base, date: record.date || "", title: record.title, text: record.content || "" };
    default:
      return { ...base, ...record };
  }
}

async function fetchList(category) {
  try {
    const res = await fetch(`${PB_URL}/api/collections/${category}/records?sort=-created`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(r => mapPbRecord(category, r));
  } catch (e) {
    console.warn("PocketBase 读取失败:", e.message);
    return [];
  }
}

function toPbRecord(category, data) {
  switch (category) {
    case "messages": return { name: data.name, content: data.text };
    case "members": return { name: data.name, bio: data.note || "", role: data.role || "" };
    case "news": return { title: data.title, date: data.date || toDateStr(new Date().toISOString()), content: data.text || "" };
    case "photos": return { title: data.name, description: data.caption || "", source_url: data.image || "" };
    case "activities": return { tag: data.tag || "", title: data.title, content: data.text || "", source_url: data.image || "" };
    case "memories": return { name: data.name || "", content: data.text || "" };
    case "history": return { date: data.date || "", title: data.title, content: data.text || "" };
    default: return { ...data };
  }
}

async function createItem(category, data) {
  const hasFile = data._file instanceof File;
  if (hasFile) {
    const fd = new FormData();
    const mapped = toPbRecord(category, data);
    for (const [key, val] of Object.entries(mapped)) {
      fd.append(key, val);
    }
    fd.append(data._field || "image", data._file, data._file.name);
    const res = await fetch(`${PB_URL}/api/collections/${category}/records`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `创建失败 (${res.status})`);
    }
    const record = await res.json();
    return { ok: true, data: mapPbRecord(category, record) };
  }
  const body = toPbRecord(category, data);
  const res = await fetch(`${PB_URL}/api/collections/${category}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `创建失败 (${res.status})`);
  }
  const record = await res.json();
  return { ok: true, data: mapPbRecord(category, record) };
}

async function updateItem(category, id, data) {
  const token = await pbAuth();
  const body = (() => {
    switch (category) {
      case "activities": return { tag: data.tag, title: data.title, content: data.content, source_url: data.image_url || "" };
      default: return data;
    }
  })();
  const res = await fetch(`${PB_URL}/api/collections/${category}/records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `更新失败 (${res.status})`);
  }
  return { ok: true };
}

async function deleteItem(category, id) {
  const token = await pbAuth();
  const res = await fetch(`${PB_URL}/api/collections/${category}/records/${id}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `删除失败 (${res.status})`);
  }
  return { ok: true };
}

const domCache = new Map();

function getCachedElement(id) {
  if (!domCache.has(id)) {
    domCache.set(id, document.getElementById(id));
  }
  return domCache.get(id);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
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
  if (toggle) {
    toggle.textContent = enabled ? "退出管理员模式" : "管理员模式";
  }
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
    if (isAdminMode()) {
      setAdminMode(false);
      return;
    }
    const input = window.prompt("请输入管理员密码");
    if (input === null) return;
    if (input === ADMIN_PASSWORD) {
      setAdminMode(true);
      return;
    }
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
      <p>${escapeHtml(post.text)}</p>
      <time>${escapeHtml(post.date || post.created_at)}</time>
      ${deleteActionMarkup(category, post.id)}
    </article>
  `).join("");
}

async function handleDeleteAction(category, id, rerender) {
  if (!isAdminMode()) {
    showToast("只有管理员可以删除内容。", "error");
    return;
  }
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
