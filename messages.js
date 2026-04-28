function bindMessageForm() {
  const form = document.getElementById("message-form");
  const nameInput = document.getElementById("message-name");
  const textInput = document.getElementById("message-text");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      name: nameInput.value.trim(),
      text: textInput.value.trim(),
      date: new Date().toLocaleDateString("zh-CN")
    };
    if (!item.name || !item.text) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await createItem("messages", item);
      });
      showToast("发布成功！", "success");
      await renderPostsFromApi("messages", "message-list", "还没有留言，快来说点什么吧。");
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
    await handleDeleteAction("messages", button.dataset.id, () =>
      renderPostsFromApi("messages", "message-list", "还没有留言，快来说点什么吧。")
    );
  });
}

requestAnimationFrame(() => renderPostsFromApi("messages", "message-list", "还没有留言，快来说点什么吧。"));
bindMessageForm();
bindMessageDelete();
document.addEventListener("adminmodechange", () =>
  renderPostsFromApi("messages", "message-list", "还没有留言，快来说点什么吧。")
);
