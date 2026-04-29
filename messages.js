async function renderMessages() {
  const target = document.getElementById("message-list");
  if (!target) return;

  const messages = await fetchList("messages");
  if (!messages.length) {
    target.innerHTML = `<div class="empty-state">还没有留言，快来说点什么吧。</div>`;
    return;
  }

  target.innerHTML = messages.map((message) => `
    <article class="post-card">
      <strong>${escapeHtml(message.name)}</strong>
      <p>${escapeHtml(message.content || message.text)}</p>
      <time>${escapeHtml(message.created_at || message.date)}</time>
      ${deleteActionMarkup("messages", message.id)}
    </article>
  `).join("");
}

function bindMessageForm() {
  const form = document.getElementById("message-form");
  const nameInput = document.getElementById("message-name");
  const textInput = document.getElementById("message-text");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      name: nameInput.value.trim(),
      content: textInput.value.trim(),
    };
    if (!item.name || !item.content) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await createItem("messages", item);
      });
      showToast("发布成功！", "success");
      await renderMessages();
      form.reset();
    } catch (_) {}
  });
}

function bindMessageDelete() {
  const list = document.getElementById("message-list");
  if (!list) return;

  list.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="delete-item"][data-category="messages"]');
    if (!button) return;
    await handleDeleteAction("messages", button.dataset.id, renderMessages);
  });
}

requestAnimationFrame(() => renderMessages());
bindMessageForm();
bindMessageDelete();
document.addEventListener("adminmodechange", () => renderMessages());
