async function renderPhotos() {
  const target = document.getElementById("photo-list");
  const photos = await fetchList("photos");
  if (!photos.length) {
    target.innerHTML = `<div class="empty-state">还没有照片，先上传一张班级回忆吧。</div>`;
    return;
  }
  target.innerHTML = (await Promise.all(photos.map(async (photo) => {
    const comments = await fetchComments("photo", photo.id);
    return `
    <article class="photo-card" data-photo-id="${photo.id}">
      ${imageMarkup(photo.image || photo.image_url, photo.caption || photo.description || photo.title || "照片", "class-uploads")}
      <div>
        <h3>${escapeHtml(photo.name || photo.title)}</h3>
        <p>${escapeHtml(photo.caption || photo.description)}</p>
        <time>${escapeHtml(photo.date || photo.created_at)}</time>
        ${deleteActionMarkup("photos", photo.id)}
        <section class="comment-section">
          <h4>评论区（${comments.length}）</h4>
          <div class="comment-list">
            ${comments.length ? comments.map((comment) => `
              <article class="comment-item">
                <p><strong>${escapeHtml(comment.name || "匿名同学")}</strong>：${escapeHtml(comment.content)}</p>
                <time>${escapeHtml(comment.created_at)}</time>
                ${deleteActionMarkup("comments", comment.id, "删除评论")}
              </article>
            `).join("") : `<p class="comment-empty">还没有评论，来抢沙发吧。</p>`}
          </div>
          <form class="comment-form" data-photo-id="${photo.id}">
            <input type="text" name="name" placeholder="你的名字" required>
            <textarea name="content" rows="2" placeholder="说点什么..." required></textarea>
            <button class="button ghost" type="submit">发表评论</button>
          </form>
        </section>
      </div>
    </article>
  `;
  }))).join("");
}

function bindPhotoForm() {
  const form = document.getElementById("photo-form");
  const nameInput = document.getElementById("photo-name");
  const captionInput = document.getElementById("photo-caption");
  const fileInput = document.getElementById("photo-file");
  const preview = document.getElementById("photo-preview");

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
        const data = { title: name, description: caption };
        data._file = file;
        data._field = "image_url";
        await createItem("photos", data);
      });
      showToast("上传成功！", "success");
      await renderPhotos();
      form.reset();
      preview.src = "../assets/class-photo.jpg";
    } catch (_) {}
  });
}

function bindPhotoDelete() {
  const list = document.getElementById("photo-list");
  if (!list) return;

  list.addEventListener("submit", async (event) => {
    const form = event.target.closest(".comment-form[data-photo-id]");
    if (!form) return;
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const content = form.elements.content.value.trim();
    if (!name || !content) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await addComment("photo", form.dataset.photoId, name, content);
      });
      showToast("评论已发布！", "success");
      await renderPhotos();
    } catch (_) {}
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="delete-item"][data-category="photos"]');
    if (button) {
      await handleDeleteAction("photos", button.dataset.id, renderPhotos);
      return;
    }
    const deleteCommentBtn = event.target.closest('[data-action="delete-item"][data-category="comments"]');
    if (deleteCommentBtn) {
      await handleDeleteAction("comments", deleteCommentBtn.dataset.id, renderPhotos);
    }
  });
}

requestAnimationFrame(() => renderPhotos());
bindPhotoForm();
bindPhotoDelete();
document.addEventListener("adminmodechange", () => renderPhotos());
