const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const ACCESS_PASSWORD = "152025";
const ACCESS_STORAGE_KEY = "site-access-granted";

const domCache = new Map();

function getCachedElement(id) {
  if (!domCache.has(id)) {
    domCache.set(id, document.getElementById(id));
  }
  return domCache.get(id);
}

setupPasswordGate();

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

const defaults = {
  members: [],
  memories: [
    {
      name: "班长",
      text: "最难忘的是毕业前最后一次大扫除，大家一边收拾教室，一边把黑板写满祝福。",
      date: "2026-04-23"
    },
    {
      name: "语文课代表",
      text: "高三的早读声、同桌递来的草稿纸、月考后的互相安慰，都值得被记住。",
      date: "2026-04-23"
    }
  ],
  messages: [
    {
      name: "老同学",
      text: "我现在在上海工作，十年聚会如果定在暑假，大概率可以参加。",
      date: "2026-04-23"
    }
  ],
  photos: [
    {
      name: "高2022级15班",
      caption: "高2022级15班全班合影，属于大家的第一张首页主图。",
      image: "assets/class-photo.jpg",
      date: "2026-04-23"
    },
    {
      name: "资料组",
      caption: "高2022级15班曾饭指南，全班同学升学去向纪念图。",
      image: "assets/class-destination-map.jpg",
      date: "2026-04-23"
    }
  ],
  activities: [
    {
      tag: "运动会",
      title: "接力赛后的拥抱",
      text: "不只是名次，更是一起跑完、一起喊到嗓子沙哑的下午。",
      image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80"
    },
    {
      tag: "元旦晚会",
      title: "教室里的小舞台",
      text: "把课桌推到两边之后，整个教室都像临时搭起来的剧场。",
      image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80"
    },
    {
      tag: "毕业旅行",
      title: "出发那天的晴天",
      text: "有人拍照，有人整理零食，车刚开动，笑声就已经坐满了整排座位。",
      image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"
    }
  ],
  news: [
    {
      date: "2026-05-01",
      title: "十年聚会意向征集",
      text: "请同学们在留言板留下所在城市和可参加时间，班委将汇总后确定地点。"
    },
    {
      date: "2026-04-20",
      title: "毕业照电子版整理中",
      text: "如果你手里有高清活动照片，可以发给资料组统一归档。"
    },
    {
      date: "2026-04-12",
      title: "班级通讯录更新",
      text: "请确认自己的邮箱、城市和常用联系方式，便于后续活动通知。"
    }
  ],
  history: [
    {
      date: "2022-09",
      title: "开学与军训",
      text: "第一次集合、第一次点名，班级故事从这里开始。"
    },
    {
      date: "2023-10",
      title: "运动会总分突破",
      text: "接力、跳高、长跑和后勤组一起撑起了那次高光时刻。"
    },
    {
      date: "2024-12",
      title: "最后一次元旦晚会",
      text: "节目、掌声和合唱让教室变成临时舞台。"
    },
    {
      date: "2025-06",
      title: "毕业合影",
      text: "照片定格了那天的阳光，也定格了每个人的高中模样。"
    }
  ]
};

function readPosts(key) {
  const stored = localStorage.getItem(key);
  if (!stored) {
    return defaults[key] || [];
  }

  try {
    return JSON.parse(stored);
  } catch {
    return defaults[key] || [];
  }
}

function setupPasswordGate() {
  const gate = getCachedElement("password-gate");
  const form = getCachedElement("password-form");
  const input = getCachedElement("password-input");
  const error = getCachedElement("password-error");
  const accessGranted = sessionStorage.getItem(ACCESS_STORAGE_KEY) === "yes";

  if (!gate || !form || !input || !error) {
    return;
  }

  if (!accessGranted) {
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

function writePosts(key, posts) {
  localStorage.setItem(key, JSON.stringify(posts));
}

function removeDemoMembers() {
  const demoNames = new Set(["张三", "李想", "王宇", "陈晨"]);
  const members = readPosts("members");
  const realMembers = members.filter((member) => !demoNames.has(member.name));

  if (realMembers.length !== members.length) {
    writePosts("members", realMembers);
  }
}

function renderMembers() {
  const target = document.getElementById("member-list");
  const members = readPosts("members");

  if (!members.length) {
    target.innerHTML = `<div class="empty-state">还没有成员，请添加真实的 15 班同学信息。</div>`;
    return;
  }

  target.innerHTML = members
    .map((member) => {
      return `
        <article class="member-card">
          <img src="${escapeAttribute(member.photo)}" alt="${escapeAttribute(member.name)}的照片" loading="lazy">
          <div>
            <h3>${escapeHtml(member.name)}</h3>
            <p>${escapeHtml(member.note)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPosts(key, targetId, emptyText) {
  const target = document.getElementById(targetId);
  const posts = readPosts(key);

  if (!posts.length) {
    target.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  target.innerHTML = posts
    .map((post) => {
      return `
        <article class="post-card">
          <strong>${escapeHtml(post.name)}</strong>
          <p>${escapeHtml(post.text)}</p>
          <time>${escapeHtml(post.date)}</time>
        </article>
      `;
    })
    .join("");
}

function renderPhotos() {
  const target = document.getElementById("photo-list");
  const photos = readPosts("photos");

  if (!photos.length) {
    target.innerHTML = `<div class="empty-state">还没有照片，先上传一张班级回忆吧。</div>`;
    return;
  }

  target.innerHTML = photos
    .map((photo) => {
      return `
        <article class="photo-card">
          <img src="${escapeAttribute(photo.image)}" alt="${escapeAttribute(photo.caption)}" loading="lazy">
          <div>
            <h3>${escapeHtml(photo.name)}</h3>
            <p>${escapeHtml(photo.caption)}</p>
            <time>${escapeHtml(photo.date)}</time>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderActivities() {
  const target = document.getElementById("activity-list");
  const activities = readPosts("activities");

  if (!activities.length) {
    target.innerHTML = `<div class="empty-state">还没有班级活动，先添加一条值得记住的活动吧。</div>`;
    return;
  }

  target.innerHTML = activities
    .map((item, index) => {
      const largeClass = index === 0 ? " large" : "";
      return `
        <article class="activity-card${largeClass}">
          <img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.title)}" loading="lazy">
          <div>
            <span>${escapeHtml(item.tag)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
            <div class="activity-actions">
              <button class="button ghost" type="button" data-action="edit-activity" data-index="${index}">编辑</button>
              <button class="button ghost danger" type="button" data-action="delete-activity" data-index="${index}">删除</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderNews() {
  const target = document.getElementById("news-list");
  const news = readPosts("news");

  if (!news.length) {
    target.innerHTML = `<div class="empty-state">还没有班级新闻，可以先发布一条通知。</div>`;
    return;
  }

  target.innerHTML = news
    .map((item) => {
      return `
        <article>
          <time datetime="${escapeAttribute(item.date)}">${formatDate(item.date)}</time>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `;
    })
    .join("");
}

function renderHistory() {
  const target = document.getElementById("history-list");
  const history = readPosts("history");

  if (!history.length) {
    target.innerHTML = `<li><span>待补充</span><h3>还没有班级历史</h3><p>可以添加第一条 15 班的重要事件。</p></li>`;
    return;
  }

  target.innerHTML = history
    .map((item) => {
      return `
        <li>
          <span>${formatMonth(item.date)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </li>
      `;
    })
    .join("");
}

function bindPostForm({ formId, nameId, textId, storageKey, listId, emptyText }) {
  const form = document.getElementById(formId);
  const nameInput = document.getElementById(nameId);
  const textInput = document.getElementById(textId);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const post = {
      name: nameInput.value.trim(),
      text: textInput.value.trim(),
      date: new Date().toLocaleDateString("zh-CN")
    };

    if (!post.name || !post.text) {
      return;
    }

    const posts = readPosts(storageKey);
    posts.unshift(post);
    writePosts(storageKey, posts);
    requestAnimationFrame(() => renderPosts(storageKey, listId, emptyText));
    form.reset();
  });
}

function bindActivityForm() {
  const form = document.getElementById("activity-form");
  const editIndexInput = document.getElementById("activity-edit-index");
  const tagInput = document.getElementById("activity-tag");
  const titleInput = document.getElementById("activity-title-input");
  const textInput = document.getElementById("activity-text");
  const fileInput = document.getElementById("activity-file");
  const preview = document.getElementById("activity-preview");
  const submitButton = document.getElementById("activity-submit");
  const list = document.getElementById("activity-list");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) {
      return;
    }

    preview.src = await imageFileToDataUrl(file);
  }, { passive: true });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const index = Number(button.dataset.index);
    const activities = readPosts("activities");
    const item = activities[index];

    if (!item) {
      return;
    }

    if (button.dataset.action === "edit-activity") {
      editIndexInput.value = String(index);
      tagInput.value = item.tag;
      titleInput.value = item.title;
      textInput.value = item.text;
      preview.src = item.image;
      submitButton.textContent = "保存修改";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (button.dataset.action === "delete-activity") {
      activities.splice(index, 1);
      writePosts("activities", activities);
      requestAnimationFrame(renderActivities);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const editIndex = editIndexInput.value;
    const tag = tagInput.value.trim();
    const title = titleInput.value.trim();
    const text = textInput.value.trim();

    if (!tag || !title || !text) {
      return;
    }

    const activities = readPosts("activities");
    const isEditing = editIndex !== "";
    const existing = isEditing ? activities[Number(editIndex)] : null;
    const image = fileInput.files[0]
      ? await imageFileToDataUrl(fileInput.files[0])
      : existing?.image || preview.src;

    const item = { tag, title, text, image };

    if (isEditing) {
      activities[Number(editIndex)] = item;
    } else {
      activities.unshift(item);
    }

    writePosts("activities", activities);
    requestAnimationFrame(renderActivities);
    form.reset();
    editIndexInput.value = "";
    preview.src = "assets/class-photo.jpg";
    submitButton.textContent = "添加活动";
  });
}

function bindNewsForm() {
  const form = document.getElementById("news-form");
  const dateInput = document.getElementById("news-date");
  const titleInput = document.getElementById("news-title-input");
  const textInput = document.getElementById("news-text");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const item = {
      date: dateInput.value,
      title: titleInput.value.trim(),
      text: textInput.value.trim()
    };

    if (!item.date || !item.title || !item.text) {
      return;
    }

    const news = readPosts("news");
    news.unshift(item);
    writePosts("news", news);
    requestAnimationFrame(renderNews);
    form.reset();
  });
}

function bindHistoryForm() {
  const form = document.getElementById("history-form");
  const dateInput = document.getElementById("history-date");
  const titleInput = document.getElementById("history-title-input");
  const textInput = document.getElementById("history-text");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const item = {
      date: dateInput.value,
      title: titleInput.value.trim(),
      text: textInput.value.trim()
    };

    if (!item.date || !item.title || !item.text) {
      return;
    }

    const history = readPosts("history");
    history.push(item);
    writePosts("history", history);
    requestAnimationFrame(renderHistory);
    form.reset();
  });
}

function bindPhotoForm() {
  const form = document.getElementById("photo-form");
  const nameInput = document.getElementById("photo-name");
  const captionInput = document.getElementById("photo-caption");
  const fileInput = document.getElementById("photo-file");
  const preview = document.getElementById("photo-preview");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) {
      return;
    }

    preview.src = await imageFileToDataUrl(file);
  }, { passive: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = fileInput.files[0];
    const name = nameInput.value.trim();
    const caption = captionInput.value.trim();

    if (!name || !caption || !file) {
      return;
    }

    const photo = {
      name,
      caption,
      image: await imageFileToDataUrl(file),
      date: new Date().toLocaleDateString("zh-CN")
    };

    const photos = readPosts("photos");
    photos.unshift(photo);
    writePosts("photos", photos);
    requestAnimationFrame(renderPhotos);
    form.reset();
  });
}

function bindMemberForm() {
  const form = document.getElementById("member-form");
  const nameInput = document.getElementById("member-name");
  const noteInput = document.getElementById("member-note");
  const photoInput = document.getElementById("member-photo");
  const preview = document.getElementById("member-preview");

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) {
      return;
    }

    preview.src = await imageFileToDataUrl(file);
  }, { passive: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = photoInput.files[0];
    const name = nameInput.value.trim();
    const note = noteInput.value.trim();

    if (!name || !note || !file) {
      return;
    }

    const member = {
      name,
      note,
      photo: await imageFileToDataUrl(file)
    };

    const members = readPosts("members");
    members.unshift(member);
    writePosts("members", members);
    requestAnimationFrame(renderMembers);
    form.reset();
  });
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

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    };

    return entities[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function formatDate(value) {
  return value.replaceAll("-", ".");
}

function formatMonth(value) {
  return value.replace("-", ".");
}

removeDemoMembers();
requestAnimationFrame(() => {
  renderMembers();
  renderActivities();
  renderPhotos();
  renderNews();
  renderHistory();
  renderPosts("memories", "memory-list", "还没有回忆，成为第一个记录的人。");
  renderPosts("messages", "message-list", "还没有留言，先写下一句近况吧。");
});

bindMemberForm();
bindActivityForm();
bindPhotoForm();
bindNewsForm();
bindHistoryForm();

bindPostForm({
  formId: "memory-form",
  nameId: "memory-name",
  textId: "memory-text",
  storageKey: "memories",
  listId: "memory-list",
  emptyText: "还没有回忆，成为第一个记录的人。"
});

bindPostForm({
  formId: "message-form",
  nameId: "message-name",
  textId: "message-text",
  storageKey: "messages",
  listId: "message-list",
  emptyText: "还没有留言，先写下一句近况吧。"
});
