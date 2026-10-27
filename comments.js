const COMMENT_FIELDS = "id,target_type,target_id,name,content,created_at";
const COMMENT_TIMEOUT_MS = 8000;
const commentSections = new WeakMap();
let commentAdminSession = null;
let commentAdminTimer;

async function withCommentTimeout(operation, mutation = false) {
  const controller = new AbortController();
  const message = mutation
    ? "请求超时，操作结果尚未确认。请先刷新评论，再决定是否重试。"
    : "评论请求超时，请重试。";
  let timer;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(message));
        }, COMMENT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(message);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function commentTarget(targetType, targetId) {
  const id = String(targetId ?? "").trim();
  if (!["photo", "memory"].includes(targetType) || !id || id.length > 128) {
    throw new Error("评论对应的内容无效，请刷新页面。");
  }
  return { target_type: targetType, target_id: id };
}

function isCommentRecord(row, target) {
  return row && typeof row === "object" && row.id != null && String(row.id) !== ""
    && row.target_type === target.target_type && String(row.target_id) === target.target_id
    && typeof row.name === "string" && typeof row.content === "string"
    && typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at));
}

async function fetchComments(targetType, targetId) {
  const target = commentTarget(targetType, targetId);
  const rows = await withCommentTimeout(signal => supabaseFetch("comments", {
    signal,
    params: `?select=${COMMENT_FIELDS}&target_type=eq.${encodeURIComponent(target.target_type)}&target_id=eq.${encodeURIComponent(target.target_id)}&order=created_at.asc,id.asc`,
  }));
  if (!Array.isArray(rows) || !rows.every(row => isCommentRecord(row, target))) {
    throw new Error("评论数据暂时无法显示，请重试。");
  }
  return rows;
}

async function addComment(targetType, targetId, name, content) {
  const target = commentTarget(targetType, targetId);
  const body = { ...target, name: String(name || "").trim(), content: String(content || "").trim() };
  if (!body.name || body.name.length > 80 || !body.content || body.content.length > 2000) {
    throw new Error("请填写姓名（最多 80 字）和评论（最多 2000 字）。");
  }
  const rows = await withCommentTimeout(signal => supabaseFetch("comments", {
    signal, method: "POST", params: `?select=${COMMENT_FIELDS}`,
    headers: { Prefer: "return=representation" }, body,
  }), true);
  if (!Array.isArray(rows) || rows.length !== 1 || !isCommentRecord(rows[0], target)) {
    throw new Error("无法确认评论是否已保存，请先刷新评论后再重试。");
  }
  return rows[0];
}

function isCommentAdmin() {
  return !!commentAdminSession && commentAdminSession.expiresAt > Date.now();
}

function signOutCommentAdmin() {
  commentAdminSession = null;
  clearTimeout(commentAdminTimer);
  document.dispatchEvent(new Event("commentadminchange"));
}

async function signInCommentAdmin(email, password) {
  // Keep only the short-lived access token in memory, never the password or refresh token.
  const result = await withCommentTimeout(async signal => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", signal,
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error("登录失败，请核对管理员邮箱和密码。");
    return data;
  });
  if (!result.access_token || result.user?.app_metadata?.comments_admin !== true) {
    throw new Error("此账号没有评论管理权限。");
  }
  const expiresAt = Number(result.expires_at) * 1000 || Date.now() + Number(result.expires_in) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error("登录已过期，请重新登录。");
  clearTimeout(commentAdminTimer);
  commentAdminSession = { accessToken: result.access_token, expiresAt };
  commentAdminTimer = setTimeout(signOutCommentAdmin, Math.min(expiresAt - Date.now(), 2147483647));
  document.dispatchEvent(new Event("commentadminchange"));
}

async function deleteComment(id) {
  if (!isCommentAdmin()) throw new Error("请先登录评论管理员。");
  const rows = await withCommentTimeout(signal => supabaseFetch("comments", {
    signal, method: "DELETE", params: `?id=eq.${encodeURIComponent(id)}&select=id`,
    headers: { Authorization: `Bearer ${commentAdminSession.accessToken}`, Prefer: "return=representation" },
  }), true);
  if (!Array.isArray(rows) || rows.length !== 1 || String(rows[0]?.id) !== String(id)) {
    throw new Error("未确认删除成功：评论可能已不存在或当前账号无权删除，请刷新后检查。");
  }
  return rows[0];
}

function commentSectionMarkup(targetType, targetId) {
  return `<section class="comment-section" data-target-type="${escapeAttribute(targetType)}" data-target-id="${escapeAttribute(targetId)}">
    <h4>评论区</h4>
    <p class="comment-status" role="status">正在加载评论…</p>
    <button class="button ghost comment-retry" type="button" data-action="retry-comments" hidden>重新加载评论</button>
    <div class="comment-list"></div>
    <form class="comment-form">
      <label>你的名字<input type="text" name="name" maxlength="80" autocomplete="name" required></label>
      <label>评论<textarea name="content" rows="2" maxlength="2000" placeholder="说点什么..." required></textarea></label>
      <button class="button ghost" type="submit">发表评论</button>
    </form>
  </section>`;
}

function sectionState(section) {
  if (!commentSections.has(section)) commentSections.set(section, { rows: [], loaded: false, version: 0 });
  return commentSections.get(section);
}

function renderCommentRows(section) {
  const state = sectionState(section);
  section.querySelector("h4").textContent = state.loaded ? `评论区（${state.rows.length}）` : "评论区";
  section.querySelector(".comment-list").innerHTML = state.rows.length
    ? state.rows.map(row => `<article class="comment-item">
      <p><strong>${escapeHtml(row.name || "匿名同学")}</strong>：${escapeHtml(row.content)}</p>
      <time>${escapeHtml(row.created_at)}</time>
      ${isCommentAdmin() ? `<button class="button ghost danger" type="button" data-action="delete-comment" data-id="${escapeAttribute(row.id)}">删除评论</button>` : ""}
    </article>`).join("")
    : state.loaded ? `<p class="comment-empty">还没有评论，来抢沙发吧。</p>` : "";
}

async function refreshCommentSection(section) {
  const state = sectionState(section);
  const version = ++state.version;
  const status = section.querySelector(".comment-status");
  const retry = section.querySelector(".comment-retry");
  status.textContent = "正在加载评论…";
  retry.hidden = true;
  try {
    const rows = await fetchComments(section.dataset.targetType, section.dataset.targetId);
    if (!section.isConnected || version !== state.version) return;
    state.rows = rows;
    state.loaded = true;
    renderCommentRows(section);
    status.textContent = "";
  } catch (_) {
    if (!section.isConnected || version !== state.version) return;
    status.textContent = state.loaded ? "评论刷新失败，当前显示上次加载的内容。" : "评论暂时无法加载，请重试。";
  } finally {
    if (section.isConnected && version === state.version) retry.hidden = false;
  }
}

function loadCommentSections(root) {
  // Intentionally independent from the parent photo/memory render.
  for (const section of root.querySelectorAll(".comment-section")) void refreshCommentSection(section);
}

function bindCommentEvents(root) {
  if (!root) return;
  root.addEventListener("submit", async event => {
    const form = event.target.closest(".comment-form");
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const section = form.closest(".comment-section");
    try {
      const row = await withSubmitLoading(button, () => addComment(section.dataset.targetType, section.dataset.targetId,
        form.elements.name.value, form.elements.content.value));
      if (!section.isConnected) { showToast("评论已发布，请刷新查看。", "success"); return; }
      const state = sectionState(section);
      ++state.version; // Ignore an older read that could hide the newly confirmed record.
      state.rows = [...state.rows.filter(item => String(item.id) !== String(row.id)), row];
      renderCommentRows(section);
      section.querySelector(".comment-status").textContent = state.loaded ? "" : "评论已发布，其他评论尚未加载，请重新加载查看。";
      section.querySelector(".comment-retry").hidden = false;
      form.reset();
      showToast("评论已发布！", "success");
    } catch (_) {} // withSubmitLoading keeps the draft and reports the error.
  });
  root.addEventListener("click", async event => {
    const button = event.target.closest('[data-action="retry-comments"], [data-action="delete-comment"]');
    if (!button || !root.contains(button) || button.disabled) return;
    const section = button.closest(".comment-section");
    if (button.dataset.action === "retry-comments") { await refreshCommentSection(section); return; }
    if (!window.confirm("确定删除这条评论？")) return;
    try {
      await withSubmitLoading(button, () => deleteComment(button.dataset.id));
      if (section.isConnected) {
        const state = sectionState(section);
        ++state.version;
        state.rows = state.rows.filter(row => String(row.id) !== button.dataset.id);
        renderCommentRows(section);
        section.querySelector(".comment-status").textContent = state.loaded ? "" : "评论已删除，其他评论尚未加载。";
        section.querySelector(".comment-retry").hidden = false;
      }
      showToast("评论已删除。", "success");
    } catch (_) {}
  });
  document.addEventListener("commentadminchange", () => {
    for (const section of root.querySelectorAll(".comment-section")) renderCommentRows(section);
  });
}

function setupCommentAdmin() {
  const toggle = document.getElementById("comment-admin-toggle");
  const status = document.getElementById("comment-admin-status");
  if (!toggle || !status) return;
  const dialog = document.createElement("dialog");
  dialog.className = "comment-login";
  dialog.setAttribute("aria-labelledby", "comment-login-title");
  dialog.innerHTML = `<form class="stacked-form">
    <h2 id="comment-login-title">评论管理员登录</h2>
    <label>管理员邮箱<input type="email" name="email" autocomplete="username" required></label>
    <label>密码<input type="password" name="password" autocomplete="current-password" required></label>
    <p class="comment-login-error" role="alert"></p>
    <div class="hero-actions"><button class="button primary" type="submit">登录</button>
    <button class="button ghost" type="button" data-action="cancel-login">取消</button></div>
  </form>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector("form");
  let loginVersion = 0;
  dialog.addEventListener("close", () => { ++loginVersion; form.reset(); });
  dialog.querySelector('[data-action="cancel-login"]').addEventListener("click", () => dialog.close());
  toggle.addEventListener("click", () => {
    if (isCommentAdmin()) { signOutCommentAdmin(); return; }
    dialog.querySelector(".comment-login-error").textContent = "";
    dialog.showModal();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const attempt = ++loginVersion;
    try {
      await withSubmitLoading(button, () => signInCommentAdmin(form.elements.email.value, form.elements.password.value));
      if (attempt !== loginVersion || !dialog.open) { signOutCommentAdmin(); return; }
      dialog.close();
    } catch (error) {
      if (attempt === loginVersion) dialog.querySelector(".comment-login-error").textContent = error.message;
    } finally { form.elements.password.value = ""; }
  });
  document.addEventListener("commentadminchange", () => {
    toggle.textContent = isCommentAdmin() ? "退出评论管理" : "评论管理";
    status.textContent = isCommentAdmin() ? "已登录，可删除评论。" : "";
  });
}

setupCommentAdmin();
