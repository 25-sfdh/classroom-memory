// ── 首页渲染：所有数据从 PocketBase 读取 ──

async function renderMembers() {
  const target = document.getElementById("member-list");
  if (!target) return;
  const members = await fetchList("members");
  if (!members.length) {
    target.innerHTML = `<div class="empty-state">还没有成员，请添加真实的 15 班同学信息。</div>`;
    return;
  }
  target.innerHTML = members.map((member) => `
    <article class="member-card">
      <img src="${escapeAttribute(member.photo)}" alt="${escapeAttribute(member.name)}的照片" loading="lazy">
      <div>
        <h3>${escapeHtml(member.name)}</h3>
        <p>${escapeHtml(member.note)}</p>
      </div>
    </article>
  `).join("");
}

async function renderPhotos() {
  const target = document.getElementById("photo-list");
  if (!target) return;
  const photos = await fetchList("photos");
  if (!photos.length) {
    target.innerHTML = `<div class="empty-state">还没有照片，先上传一张班级回忆吧。</div>`;
    return;
  }
  target.innerHTML = photos.map((photo) => `
    <article class="photo-card">
      <img src="${escapeAttribute(photo.image)}" alt="${escapeAttribute(photo.caption)}" loading="lazy">
      <div>
        <h3>${escapeHtml(photo.name)}</h3>
        <p>${escapeHtml(photo.caption)}</p>
        <time>${escapeHtml(photo.date || photo.created_at)}</time>
      </div>
    </article>
  `).join("");
}

async function renderActivities() {
  const target = document.getElementById("activity-list");
  if (!target) return;
  const activities = await fetchList("activities");
  if (!activities.length) {
    target.innerHTML = `<div class="empty-state">还没有班级活动，先添加一条值得记住的活动吧。</div>`;
    return;
  }
  target.innerHTML = activities.map((item, index) => {
    const largeClass = index === 0 ? " large" : "";
    return `
      <article class="activity-card${largeClass}">
        <img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.title)}" loading="lazy">
        <div>
          <span>${escapeHtml(item.tag)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </div>
      </article>
    `;
  }).join("");
}

async function renderNews() {
  const target = document.getElementById("news-list");
  if (!target) return;
  const news = await fetchList("news");
  if (!news.length) {
    target.innerHTML = `<div class="empty-state">还没有班级新闻，可以先发布一条通知。</div>`;
    return;
  }
  target.innerHTML = news.map((item) => `
    <article>
      <time datetime="${escapeAttribute(item.date)}">${formatDate(item.date)}</time>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("");
}

async function renderHistory() {
  const target = document.getElementById("history-list");
  if (!target) return;
  const history = await fetchList("history");
  if (!history.length) {
    target.innerHTML = `<li><span>待补充</span><h3>还没有班级历史</h3><p>可以添加第一条 15 班的重要事件。</p></li>`;
    return;
  }
  target.innerHTML = history.map((item) => `
    <li>
      <span>${formatMonth(item.date)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
    </li>
  `).join("");
}

async function renderPosts(category, targetId, emptyText) {
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

// ── 首页表单：提交到 PocketBase ──

function bindPostForm({ formId, nameId, textId, category, listId, emptyText }) {
  const form = document.getElementById(formId);
  if (!form) return;
  const nameInput = document.getElementById(nameId);
  const textInput = document.getElementById(textId);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      name: nameInput.value.trim(),
      text: textInput.value.trim(),
    };
    if (!item.name || !item.text) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await createItem(category, item);
      });
      showToast("发布成功！", "success");
      await renderPosts(category, listId, emptyText);
      form.reset();
    } catch (_) {}
  });
}

function bindPhotoForm() {
  const form = document.getElementById("photo-form");
  if (!form) return;
  const nameInput = document.getElementById("photo-name");
  const captionInput = document.getElementById("photo-caption");
  const fileInput = document.getElementById("photo-file");
  const preview = document.getElementById("photo-preview");
  if (!fileInput || !preview) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    preview.src = await imageFileToDataUrl(file);
  }, { passive: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    const name = nameInput.value.trim();
    const caption = captionInput.value.trim();
    if (!name || !caption || !file) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        const data = { name, caption };
        data._file = file;
        await createItem("photos", data);
      });
      showToast("上传成功！", "success");
      await renderPhotos();
      form.reset();
      preview.src = "../assets/class-photo.jpg";
    } catch (_) {}
  });
}

function bindMemberForm() {
  const form = document.getElementById("member-form");
  if (!form) return;
  const nameInput = document.getElementById("member-name");
  const noteInput = document.getElementById("member-note");
  const photoInput = document.getElementById("member-photo");
  const preview = document.getElementById("member-preview");
  if (!photoInput || !preview) return;

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    preview.src = await imageFileToDataUrl(file);
  }, { passive: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = photoInput.files[0];
    const name = nameInput.value.trim();
    const note = noteInput.value.trim();
    if (!name || !note || !file) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        const member = { name, note };
        member._file = file;
        member._field = "avatar";
        await createItem("members", member);
      });
      showToast("添加成功！", "success");
      await renderMembers();
      form.reset();
      preview.src = "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80";
    } catch (_) {}
  });
}

function bindActivityForm() {
  const form = document.getElementById("activity-form");
  if (!form) return;
  const tagInput = document.getElementById("activity-tag");
  const titleInput = document.getElementById("activity-title-input");
  const textInput = document.getElementById("activity-text");
  const fileInput = document.getElementById("activity-file");
  const preview = document.getElementById("activity-preview");
  const submitButton = document.getElementById("activity-submit");
  if (!fileInput || !preview || !submitButton) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    preview.src = await imageFileToDataUrl(file);
  }, { passive: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tag = tagInput.value.trim();
    const title = titleInput.value.trim();
    const text = textInput.value.trim();
    if (!tag || !title || !text) return;

    try {
      await withSubmitLoading(submitButton, async () => {
        const data = { tag, title, text };
        if (fileInput.files[0]) {
          data._file = fileInput.files[0];
        }
        await createItem("activities", data);
      });
      showToast("添加成功！", "success");
      await renderActivities();
      form.reset();
      preview.src = "../assets/class-photo.jpg";
    } catch (_) {}
  });
}

function bindNewsForm() {
  const form = document.getElementById("news-form");
  if (!form) return;
  const dateInput = document.getElementById("news-date");
  const titleInput = document.getElementById("news-title-input");
  const textInput = document.getElementById("news-text");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      date: dateInput.value,
      title: titleInput.value.trim(),
      text: textInput.value.trim()
    };
    if (!item.date || !item.title || !item.text) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await createItem("news", item);
      });
      showToast("发布成功！", "success");
      await renderNews();
      form.reset();
    } catch (_) {}
  });
}

function bindHistoryForm() {
  const form = document.getElementById("history-form");
  if (!form) return;
  const dateInput = document.getElementById("history-date");
  const titleInput = document.getElementById("history-title-input");
  const textInput = document.getElementById("history-text");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      date: dateInput.value,
      title: titleInput.value.trim(),
      text: textInput.value.trim()
    };
    if (!item.date || !item.title || !item.text) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await createItem("history", item);
      });
      showToast("添加成功！", "success");
      await renderHistory();
      form.reset();
    } catch (_) {}
  });
}

// ── 首次渲染 ──

requestAnimationFrame(async () => {
  await Promise.all([
    renderMembers(),
    renderActivities(),
    renderPhotos(),
    renderNews(),
    renderHistory(),
    renderPosts("memories", "memory-list", "还没有回忆，成为第一个记录的人。"),
    renderPosts("messages", "message-list", "还没有留言，先写下一句近况吧。"),
  ]);
  bindMemberForm();
  bindActivityForm();
  bindPhotoForm();
  bindNewsForm();
  bindHistoryForm();
  bindPostForm({ formId: "memory-form", nameId: "memory-name", textId: "memory-text", category: "memories", listId: "memory-list", emptyText: "还没有回忆，成为第一个记录的人。" });
  bindPostForm({ formId: "message-form", nameId: "message-name", textId: "message-text", category: "messages", listId: "message-list", emptyText: "还没有留言，先写下一句近况吧。" });
});
