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
    try {
      await createItem("messages", item);
      await renderPostsFromApi("messages", "message-list", "还没有留言，快来说点什么吧。");
      form.reset();
    } catch (e) {
      alert(e.message);
    }
  });
}

requestAnimationFrame(() => renderPostsFromApi("messages", "message-list", "还没有留言，快来说点什么吧。"));
bindMessageForm();
