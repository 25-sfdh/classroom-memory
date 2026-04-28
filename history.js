async function renderHistory() {
  const target = document.getElementById("history-list");
  const history = await fetchList("history");
  if (!history.length) {
    target.innerHTML = `<li><span>待补充</span><h3>还没有班级历史</h3><p>可以添加第一条 15 班的重要事件。</p></li>`;
    return;
  }
  target.innerHTML = history.map((item) => `
    <li>
      <span>${formatMonth(item.date)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
      ${isAdminMode() ? deleteActionMarkup("history", item.id) : ""}
    </li>
  `).join("");
}

function bindHistoryForm() {
  const form = document.getElementById("history-form");
  const dateInput = document.getElementById("history-date");
  const titleInput = document.getElementById("history-title-input");
  const textInput = document.getElementById("history-text");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      date: dateInput.value,
      title: titleInput.value.trim(),
      text: textInput.value.trim()
    };
    if (!item.date || !item.title || !item.text) return;

    const submitBtn = form.querySelector('[type="submit"]');
    try {
      await withSubmitLoading(submitBtn, async () => {
        await createItem("history", item);
      });
      showToast("添加成功！", "success");
      await renderHistory();
      form.reset();
    } catch (_) {}
  });
}

function bindHistoryDelete() {
  const list = document.getElementById("history-list");
  if (!list) return;

  list.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="delete-item"][data-category="history"]');
    if (!button) return;
    await handleDeleteAction("history", button.dataset.id, renderHistory);
  });
}

requestAnimationFrame(() => renderHistory());
bindHistoryForm();
bindHistoryDelete();
document.addEventListener("adminmodechange", () => renderHistory());
