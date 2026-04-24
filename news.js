async function renderNews() {
  const target = document.getElementById("news-list");
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

function bindNewsForm() {
  const form = document.getElementById("news-form");
  const dateInput = document.getElementById("news-date");
  const titleInput = document.getElementById("news-title-input");
  const textInput = document.getElementById("news-text");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      date: dateInput.value,
      title: titleInput.value.trim(),
      text: textInput.value.trim()
    };
    if (!item.date || !item.title || !item.text) return;
    try {
      await createItem("news", item);
      await renderNews();
      form.reset();
    } catch (e) {
      alert(e.message);
    }
  });
}

requestAnimationFrame(() => renderNews());
bindNewsForm();
