function bindMemoryForm() {
  const form = document.getElementById("memory-form");
  const nameInput = document.getElementById("memory-name");
  const textInput = document.getElementById("memory-text");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      name: nameInput.value.trim(),
      text: textInput.value.trim()
    };
    if (!item.name || !item.text) return;
    try {
      await createItem("memories", item);
      await renderPostsFromApi("memories", "memory-list", "还没有回忆，快来写下第一条吧。");
      form.reset();
    } catch (e) {
      alert(e.message);
    }
  });
}

requestAnimationFrame(() => renderPostsFromApi("memories", "memory-list", "还没有回忆，快来写下第一条吧。"));
bindMemoryForm();
