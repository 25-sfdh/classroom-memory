async function renderActivities() {
  const target = document.getElementById("activity-list");
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
          <div class="activity-actions">
            <button class="button ghost" type="button" data-action="edit-activity" data-id="${item.id}">编辑</button>
            <button class="button ghost danger" type="button" data-action="delete-activity" data-id="${item.id}">删除</button>
          </div>
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
    const id = Number(button.dataset.id);
    const activities = await fetchList("activities");
    const item = activities.find(a => a.id === id);
    if (!item) return;

    if (button.dataset.action === "edit-activity") {
      editIndexInput.value = String(id);
      tagInput.value = item.tag;
      titleInput.value = item.title;
      textInput.value = item.text;
      preview.src = item.image;
      submitButton.textContent = "保存修改";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (button.dataset.action === "delete-activity") {
      if (!confirm("确定删除这条活动？")) return;
      await deleteItem("activities", id);
      await renderActivities();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const editId = editIndexInput.value;
    const tag = tagInput.value.trim();
    const title = titleInput.value.trim();
    const text = textInput.value.trim();
    if (!tag || !title || !text) return;

    let image;
    if (fileInput.files[0]) {
      const uploaded = await uploadImage(fileInput.files[0]);
      image = uploaded.url;
    } else if (editId) {
      const activities = await fetchList("activities");
      const existing = activities.find(a => a.id === Number(editId));
      image = existing ? existing.image : "uploads/class-photo.jpg";
    } else {
      image = "uploads/class-photo.jpg";
    }

    const item = { tag, title, text, image };
    if (editId) {
      await updateItem("activities", Number(editId), item);
    } else {
      await createItem("activities", item);
    }
    await renderActivities();
    form.reset();
    editIndexInput.value = "";
    preview.src = "../assets/class-photo.jpg";
    submitButton.textContent = "添加活动";
  });
}

requestAnimationFrame(() => renderActivities());
bindActivityForm();
