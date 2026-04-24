async function renderPhotos() {
  const target = document.getElementById("photo-list");
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

    try {
      const imageUrl = await supabaseUpload(file, "photos");
      const photo = {
        name, caption,
        image: imageUrl,
        date: new Date().toLocaleDateString("zh-CN")
      };
      await createItem("photos", photo);
      await renderPhotos();
      form.reset();
      preview.src = "../assets/class-photo.jpg";
    } catch (e) {
      alert(e.message);
    }
  });
}

requestAnimationFrame(() => renderPhotos());
bindPhotoForm();
