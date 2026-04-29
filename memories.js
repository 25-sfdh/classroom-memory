function bindMemoryForm() {
  const form = document.getElementById("memory-form");
  const nameInput = document.getElementById("memory-name");
  const textInput = document.getElementById("memory-text");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      name: nameInput.value.trim(),
      content: textInput.value.trim()
    };
    if (!item.name || !item.content) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await createItem("memories", item);
      });
      showToast("发布成功！", "success");
      await renderPostsFromApi("memories", "memory-list", "还没有回忆，快来写下第一条吧。");
      form.reset();
    } catch (_) {}
  });
}

function bindMemoryDelete() {
  const list = document.getElementById("memory-list");
  if (!list) return;

  list.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="delete-item"][data-category="memories"]');
    if (!button) return;
    await handleDeleteAction("memories", button.dataset.id, () =>
      renderPostsFromApi("memories", "memory-list", "还没有回忆，快来写下第一条吧。")
    );
  });
}

requestAnimationFrame(() => renderPostsFromApi("memories", "memory-list", "还没有回忆，快来写下第一条吧。"));
bindMemoryForm();
bindMemoryDelete();
document.addEventListener("adminmodechange", () =>
  renderPostsFromApi("memories", "memory-list", "还没有回忆，快来写下第一条吧。")
);
