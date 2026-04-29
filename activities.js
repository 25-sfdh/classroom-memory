async function renderActivities() {
  const target = document.getElementById("activity-list");
  const activities = await fetchList("activities");
  if (!activities.length) {
    target.innerHTML = `<div class="empty-state">还没有班级活动，先添加一条值得记住的活动吧。</div>`;
    return;
  }
  target.innerHTML = activities.map((item, index) => {
    const largeClass = index === 0 ? " large" : "";
    const actions = `
      ${isAdminMode() ? `<button class="button ghost" type="button" data-action="edit-activity" data-id="${item.id}">编辑</button>` : ""}
      ${isAdminMode() ? `<button class="button ghost danger" type="button" data-action="delete-activity" data-id="${item.id}">删除</button>` : ""}
    `.trim();
    return `
      <article class="activity-card${largeClass}">
        ${imageMarkup(item.image, item.title || "活动图片", "activities")}
        <div>
          <span>${escapeHtml(item.tag)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
          ${actions ? `<div class="activity-actions">${actions}</div>` : ""}
        </div>
      </article>
    `;
  }).join("");
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
    if (!file) return;
    preview.src = await imageFileToDataUrl(file);
  }, { passive: true });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const activities = await fetchList("activities");
    const item = activities.find(a => String(a.id) === id);
    if (!item) return;

    if (button.dataset.action === "edit-activity") {
      if (!isAdminMode()) { showToast("只有管理员可以编辑活动。", "error"); return; }
      editIndexInput.value = String(item.id);
      tagInput.value = item.tag;
      titleInput.value = item.title;
      textInput.value = item.text;
      preview.src = item.image;
      submitButton.textContent = "保存修改";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (button.dataset.action === "delete-activity") {
      if (!isAdminMode()) { showToast("只有管理员可以删除内容。", "error"); return; }
      if (!confirm("确定删除这条活动？")) return;
      try {
        await deleteItem("activities", id);
        showToast("删除成功", "success");
        await renderActivities();
      } catch (e) {
        showToast(e.message || "删除失败，请重试", "error");
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const editId = editIndexInput.value;
    const tag = tagInput.value.trim();
    const title = titleInput.value.trim();
    const content = textInput.value.trim();
    if (!title || !content) return;

    try {
      await withSubmitLoading(submitButton, async () => {
        if (editId) {
          const updates = { tag, title, text: content };
          if (fileInput.files[0]) {
            updates._file = fileInput.files[0];
          }
          await updateItem("activities", editId, updates);
        } else {
          const data = { tag, title, text: content };
          if (fileInput.files[0]) {
            data._file = fileInput.files[0];
          }
          await createItem("activities", data);
        }
      });

      showToast(editId ? "修改已保存！" : "添加成功！", "success");
      await renderActivities();
      form.reset();
      editIndexInput.value = "";
      preview.src = "../assets/class-photo.jpg";
      submitButton.textContent = "添加活动";
    } catch (_) {}
  });
}

requestAnimationFrame(() => renderActivities());
bindActivityForm();
document.addEventListener("adminmodechange", () => renderActivities());
