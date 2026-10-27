let memoriesRenderVersion = 0;

async function renderMemories() {
  const version = ++memoriesRenderVersion;
  const list = document.getElementById("memory-list");
  if (!list) return;
  const memories = await fetchList("memories");
  if (version !== memoriesRenderVersion) return;
  if (!memories.length) {
    list.innerHTML = `<div class="empty-state">还没有回忆，快来写下第一条吧。</div>`;
    return;
  }

  list.innerHTML = memories.map(item => `
      <article class="post-card">
        <h3>${escapeHtml(item.name || "匿名同学")}</h3>
        <p>${escapeHtml(item.text || item.content)}</p>
        <time>${escapeHtml(item.date || item.created_at)}</time>
        ${deleteActionMarkup("memories", item.id)}
        ${commentSectionMarkup("memory", item.id)}
      </article>
    `).join("");
  loadCommentSections(list);
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
  });
}

requestAnimationFrame(() => renderMemories());
bindMemoryForm();
bindMemoryDelete();
bindCommentEvents(document.getElementById("memory-list"));
document.addEventListener("adminmodechange", () => renderMemories());
