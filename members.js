async function renderMembers() {
  const target = document.getElementById("member-list");
  const members = await fetchList("members");
  if (!members.length) {
    target.innerHTML = `<div class="empty-state">还没有成员，请添加真实的 15 班同学信息。</div>`;
    return;
  }
  target.innerHTML = members.map((member) => `
    <article class="member-card">
      <img src="${escapeAttribute(member.photo)}" alt="${escapeAttribute(member.name)}的照片" loading="lazy">
      <div>
        <h3>${escapeHtml(member.name)}</h3>
        <p>${escapeHtml(member.note)}</p>
      </div>
    </article>
  `).join("");
}

function bindMemberForm() {
  const form = document.getElementById("member-form");
  const nameInput = document.getElementById("member-name");
  const noteInput = document.getElementById("member-note");
  const photoInput = document.getElementById("member-photo");
  const preview = document.getElementById("member-preview");

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    preview.src = await imageFileToDataUrl(file);
  }, { passive: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = photoInput.files[0];
    const name = nameInput.value.trim();
    const note = noteInput.value.trim();
    if (!name || !note || !file) return;

    try {
      const photoUrl = await supabaseUpload(file, "members");
      const member = { name, note, photo: photoUrl };
      await createItem("members", member);
      await renderMembers();
      form.reset();
      preview.src = "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80";
    } catch (e) {
      alert(e.message);
    }
  });
}

requestAnimationFrame(() => renderMembers());
bindMemberForm();
