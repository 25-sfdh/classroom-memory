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
    await createItem("messages", item);
    await renderPostsFromApi("messages", "message-list", "还没有留言，快来说点什么吧。");
    form.reset();
  });
}

requestAnimationFrame(() => renderPostsFromApi("messages", "message-list", "还没有留言，快来说点什么吧。"));
bindMessageForm();
