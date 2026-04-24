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
    const id = button.dataset.id;
    const activities = await fetchList("activities");
    const item = activities.find(a => String(a.id) === id);
    if (!item) return;

    if (button.dataset.action === "edit-activity") {
      editIndexInput.value = String(item.id);
      tagInput.value = item.tag;
      titleInput.value = item.title;
      textInput.value = item.text;
      preview.src = item.image;
      submitButton.textContent = "保存修改";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (button.dataset.action === "delete-activity") {
      if (!confirm("确定删除这条活动？")) return;
      try {
        await deleteItem("activities", id);
        await renderActivities();
      } catch (e) {
        alert(e.message);
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const editId = editIndexInput.value;
    const tag = tagInput.value.trim();
    const title = titleInput.value.trim();
    const content = textInput.value.trim();
    if (!tag || !title || !content) return;

    try {
      let imageUrl;
      if (fileInput.files[0]) {
        imageUrl = await supabaseUpload(fileInput.files[0], "activities");
      } else if (editId) {
        const activities = await fetchList("activities");
        const existing = activities.find(a => String(a.id) === editId);
        imageUrl = existing ? existing.image : "../assets/class-photo.jpg";
      } else {
        imageUrl = "../assets/class-photo.jpg";
      }

      if (editId) {
        await updateItem("activities", Number(editId), {
          tag,
          title,
          content,
          image_url: imageUrl
        });
      } else {
        // createItem maps UI field names to DB columns via buildSupabaseRow
        await createItem("activities", { tag, title, text: content, image: imageUrl });
      }

      await renderActivities();
      form.reset();
      editIndexInput.value = "";
      preview.src = "../assets/class-photo.jpg";
      submitButton.textContent = "添加活动";
    } catch (e) {
      alert(e.message);
    }
  });
}

requestAnimationFrame(() => renderActivities());
bindActivityForm();
