async function renderMemories() {
  const list = document.getElementById("memory-list");
  const memories = await fetchList("memories");
  if (!memories.length) {
    list.innerHTML = `<div class="empty-state">还没有回忆，快来写下第一条吧。</div>`;
    return;
  }

  list.innerHTML = (await Promise.all(memories.map(async (item) => {
    const comments = await fetchComments("memory", item.id);
    return `
      <article class="post-card">
        <h3>${escapeHtml(item.name || "匿名同学")}</h3>
        <p>${escapeHtml(item.content)}</p>
        <time>${escapeHtml(item.date || item.created_at)}</time>
        ${deleteActionMarkup("memories", item.id)}
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
          <form class="comment-form" data-memory-id="${item.id}">
            <input type="text" name="name" placeholder="你的名字" required>
            <textarea name="content" rows="2" placeholder="说点什么..." required></textarea>
            <button class="button ghost" type="submit">发表评论</button>
          </form>
        </section>
      </article>
    `;
  }))).join("");
}

function bindMemoryForm() {
  const form = document.getElementById("memory-form");
  const nameInput = document.getElementById("memory-name");
  const textInput = document.getElementById("memory-text");
  const list = document.getElementById("memory-list");
  if (!form || !list) return;

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
      await renderMemories();
      form.reset();
    } catch (_) {}
  });

  list.addEventListener("submit", async (event) => {
    const commentForm = event.target.closest(".comment-form[data-memory-id]");
    if (!commentForm) return;
    event.preventDefault();
    const name = commentForm.elements.name.value.trim();
    const content = commentForm.elements.content.value.trim();
    if (!name || !content) return;

    const submitBtn = commentForm.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await addComment("memory", commentForm.dataset.memoryId, name, content);
      });
      showToast("评论已发布！", "success");
      await renderMemories();
    } catch (_) {}
  });
}

function bindMemoryDelete() {
  const list = document.getElementById("memory-list");
  if (!list) return;

  list.addEventListener("click", async (event) => {
    const deleteMemoryBtn = event.target.closest('[data-action="delete-item"][data-category="memories"]');
    if (deleteMemoryBtn) {
      await handleDeleteAction("memories", deleteMemoryBtn.dataset.id, renderMemories);
      return;
    }
    const deleteCommentBtn = event.target.closest('[data-action="delete-item"][data-category="comments"]');
    if (deleteCommentBtn) {
      await handleDeleteAction("comments", deleteCommentBtn.dataset.id, renderMemories);
    }
  });
}

requestAnimationFrame(() => renderMemories());
bindMemoryForm();
bindMemoryDelete();
document.addEventListener("adminmodechange", () => renderMemories());
