async function renderNews() {
  const target = document.getElementById("news-list");
  const news = await fetchList("news");
  if (!news.length) {
    target.innerHTML = `<div class="empty-state">还没有班级新闻，可以先发布一条通知。</div>`;
    return;
  }
  target.innerHTML = news.map((item) => `
    <article>
      <time datetime="${escapeAttribute(item.date || item.created_at)}">${formatDate((item.date || item.created_at || "").slice(0, 10))}</time>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text || item.content)}</p>
      ${isAdminMode() ? deleteActionMarkup("news", item.id) : ""}
    </article>
  `).join("");
}

function bindNewsForm() {
  const form = document.getElementById("news-form");
  const dateInput = document.getElementById("news-date");
  const titleInput = document.getElementById("news-title-input");
  const textInput = document.getElementById("news-text");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      title: titleInput.value.trim(),
      content: textInput.value.trim()
    };
    if (!item.title || !item.content) return;

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

function bindNewsDelete() {
  const list = document.getElementById("news-list");
  if (!list) return;

  list.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="delete-item"][data-category="news"]');
    if (!button) return;
    await handleDeleteAction("news", button.dataset.id, renderNews);
  });
}

requestAnimationFrame(() => renderNews());
bindNewsForm();
bindNewsDelete();
document.addEventListener("adminmodechange", () => renderNews());
