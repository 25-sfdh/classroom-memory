const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const project = path.join(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
const reply = (status, value) => ({ ok: status >= 200 && status < 300, status,
  json: async () => value, text: async () => status === 204 ? '' : JSON.stringify(value) });
const record = (type = 'memory', id = 'comment-1', target = 'shared-id') => ({
  id, target_type: type, target_id: target, name: '同学', content: '一条评论', created_at: '2026-10-27T00:00:00Z',
});

function fixture(kind = 'memory', handler = () => reply(200, [])) {
  const category = kind === 'photo' ? 'photos' : 'memories';
  const { document, Event } = parseHTML(fs.readFileSync(path.join(project, category, 'index.html'), 'utf8'));
  const root = document.getElementById(kind === 'photo' ? 'photo-list' : 'memory-list');
  const listeners = {};
  const originalListen = root.addEventListener.bind(root);
  root.addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); originalListen(type, fn); };
  const requests = [], toasts = [], timers = new Map(), storage = new Map();
  let timerId = 0;
  let now = Date.now();
  let respond = handler;
  const rows = kind === 'photo'
    ? [{ id: 'shared-id', title: '主照片', image_url: 'https://example.test/photo.jpg' }, { id: 'second', title: '另一张照片' }]
    : [{ id: 'shared-id', name: '旧记录', text: '旧正文' }, { id: 'second', name: '新记录', content: '新正文' }];
  const context = vm.createContext({
    console, document, Event, CustomEvent: Event, File: class {}, AbortController,
    Date: class extends Date { static now() { return now; } },
    requestAnimationFrame() {}, window: { confirm: () => true },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    fetch: async (raw, options) => {
      const req = { url: new URL(raw), ...options, body: options.body ? JSON.parse(options.body) : undefined };
      requests.push(req);
      if (req.url.pathname.endsWith('/' + category) && req.method === 'GET') return reply(200, rows);
      return respond(req);
    },
  });
  for (const name of ['common.js', 'comments.js', category + '.js']) {
    vm.runInContext(fs.readFileSync(path.join(project, name), 'utf8'), context, { filename: name });
  }
  context.showToast = (message, type) => toasts.push({ message, type });
  function patchForms() {
    for (const form of document.querySelectorAll('form')) {
      Object.defineProperty(form, 'elements', { configurable: true, get: () => Object.fromEntries(
        [...form.querySelectorAll('[name]')].map(el => [el.getAttribute('name'), el])) });
      form.reset = () => { for (const el of form.querySelectorAll('input, textarea')) el.value = ''; };
    }
  }
  return {
    context, document, root, requests, toasts, storage, patchForms,
    setHandler: fn => { respond = fn; },
    render: async () => { await context[kind === 'photo' ? 'renderPhotos' : 'renderMemories'](); patchForms(); },
    section: () => root.querySelector('.comment-section'),
    fireTimeout: ms => { for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); } },
    advance: ms => { now += ms; },
    submit: async () => { const form = root.querySelector('.comment-form');
      await Promise.all(listeners.submit.map(fn => fn({ target: form, preventDefault() {} }))); },
    click: async button => { await Promise.all(listeners.click.map(fn => fn({ target: button }))); },
  };
}

for (const kind of ['photo', 'memory']) {
  test(`${kind}: pending and timed-out comments never block the parent list`, async () => {
    const f = fixture(kind, () => new Promise(() => {}));
    await f.render();
    assert.equal(f.root.querySelectorAll('.comment-section').length, 2);
    assert(f.root.textContent.includes(kind === 'photo' ? '主照片' : '旧正文'));
    if (kind === 'memory') assert(f.root.textContent.includes('新正文'));
    assert(f.section().textContent.includes('正在加载'));
    f.fireTimeout(8000);
    await tick();
    assert(f.section().textContent.includes('暂时无法加载'));
    assert(!f.section().textContent.includes('还没有评论'));
    assert(f.requests.filter(r => r.url.pathname.endsWith('/comments')).every(r => r.signal.aborted));
  });

  for (const status of [400, 401, 403, 404, 500]) {
    test(`${kind}: HTTP ${status} displays an error and retry, not an empty thread`, async () => {
      const f = fixture(kind, () => reply(status, { message: 'backend error' }));
      await f.render(); await tick();
      assert(f.root.textContent.includes(kind === 'photo' ? '主照片' : '旧正文'));
      assert(f.section().querySelector('.comment-status').textContent.includes('暂时无法加载'));
      assert.equal(f.section().querySelector('.comment-retry').hidden, false);
      assert.equal(f.section().querySelector('.comment-empty'), null);
    });
  }

  test(`${kind}: retry preserves the draft and renders only the matching thread`, async () => {
    const f = fixture(kind, () => reply(403, {}));
    await f.render(); await tick();
    const section = f.section(), form = section.querySelector('form');
    form.elements.content.value = '未发出的草稿';
    f.setHandler(req => reply(200, [record(kind, 'c', req.url.searchParams.get('target_id').slice(3))]));
    await f.click(section.querySelector('.comment-retry'));
    assert(section.textContent.includes('一条评论'));
    assert.equal(form.elements.content.value, '未发出的草稿');
    f.setHandler(() => reply(500, {}));
    await f.context.refreshCommentSection(section);
    assert(section.textContent.includes('一条评论'));
    assert(section.textContent.includes('上次加载'));
  });

  test(`${kind}: confirmed insert updates only its thread and escapes content`, async () => {
    const f = fixture(kind);
    await f.render(); await tick();
    const section = f.section(), form = section.querySelector('form');
    const other = f.root.querySelectorAll('.comment-section')[1];
    const otherForm = other.querySelector('form');
    otherForm.elements.content.value = '另一条草稿';
    form.elements.name.value = ' 同学 ';
    form.elements.content.value = ' <img src=x onerror=alert(1)> ';
    f.setHandler(req => reply(201, [{ ...record(kind), ...req.body }]));
    await f.submit();
    const request = f.requests.find(r => r.method === 'POST');
    assert.deepEqual(request.body, { target_type: kind, target_id: 'shared-id', name: '同学', content: '<img src=x onerror=alert(1)>' });
    assert.equal(request.headers.Prefer, 'return=representation');
    assert.equal(section.querySelector('.comment-item img'), null);
    assert(section.querySelector('.comment-item').textContent.includes('<img'));
    assert.equal(form.elements.content.value, '');
    assert.equal(otherForm.elements.content.value, '另一条草稿');
    assert(f.toasts.some(t => t.type === 'success'));
  });

  for (const [label, status, result] of [['denied', 403, {}], ['unconfirmed', 201, []]]) {
    test(`${kind}: ${label} insert preserves input and never reports success`, async () => {
      const f = fixture(kind); await f.render(); await tick();
      const form = f.section().querySelector('form');
      form.elements.name.value = '同学'; form.elements.content.value = '草稿';
      f.setHandler(() => reply(status, result));
      await f.submit();
      assert.equal(form.elements.content.value, '草稿');
      assert.equal(form.querySelector('button').disabled, false);
      assert(f.toasts.some(t => t.type === 'error'));
      assert(!f.toasts.some(t => t.type === 'success'));
    });
  }
}

test('malformed responses, network rejection, and invalid JSON are not successful empty reads', async () => {
  for (const handler of [() => reply(200, null), () => reply(200, {}), () => { throw new Error('offline'); },
    () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }),
    () => reply(200, [record('photo')])]) {
    const f = fixture('memory', handler);
    await assert.rejects(f.context.fetchComments('memory', 'shared-id'));
  }
});

test('a stale response cannot overwrite a newer refresh', async () => {
  let release;
  const f = fixture('memory', () => new Promise(resolve => { release = resolve; }));
  const section = f.document.createElement('div');
  section.innerHTML = f.context.commentSectionMarkup('memory', 'shared-id');
  f.root.appendChild(section);
  const thread = section.firstElementChild;
  const oldRead = f.context.refreshCommentSection(thread);
  f.setHandler(() => reply(200, [{ ...record(), content: '最新结果' }]));
  await f.context.refreshCommentSection(thread);
  release(reply(200, [{ ...record(), content: '过时结果' }]));
  await oldRead;
  assert(thread.textContent.includes('最新结果'));
  assert(!thread.textContent.includes('过时结果'));
});

test('local administrator flags do not authorize comment deletion', async () => {
  const f = fixture(); f.storage.set('class15-admin-mode', 'yes');
  await assert.rejects(f.context.deleteItem('comments', 'comment-1'), /请先登录/);
  assert.equal(f.requests.length, 0);
});

test('ordinary users and user_metadata cannot grant comment administrator status', async () => {
  for (const user of [{ app_metadata: {} }, { app_metadata: {}, user_metadata: { comments_admin: true } }]) {
    const f = fixture('memory', () => reply(200, { access_token: 'test-user-token', expires_in: 3600, user }));
    await assert.rejects(f.context.signInCommentAdmin('user@example.test', 'test-password'), /没有评论管理权限/);
    assert.equal(f.context.isCommentAdmin(), false);
  }
});

async function login(f) {
  f.setHandler(() => reply(200, { access_token: 'test-admin-token', expires_in: 3600, user: { app_metadata: { comments_admin: true } } }));
  await f.context.signInCommentAdmin('admin@example.test', 'test-password');
  assert.equal(f.storage.size, 0);
}

test('administrator DELETE carries the user token and requires the exact affected row', async () => {
  const f = fixture(); await login(f);
  for (const [status, result] of [[204, null], [200, []], [200, [{ id: 'different-id' }]]]) {
    f.setHandler(() => reply(status, result));
    await assert.rejects(f.context.deleteComment('comment-1'), /未确认删除成功/);
  }
  f.setHandler(() => reply(200, [{ id: 'comment-1' }]));
  await f.context.deleteComment('comment-1');
  const req = f.requests.at(-1);
  assert.equal(req.headers.Authorization, 'Bearer test-admin-token');
  assert.equal(req.headers.Prefer, 'return=representation');
  f.context.signOutCommentAdmin();
  await assert.rejects(f.context.deleteComment('comment-1'), /请先登录/);
});

test('failed deletion leaves the visible row; confirmed deletion removes it', async () => {
  const f = fixture('memory', req => reply(200, [record('memory', 'comment-1', req.url.searchParams.get('target_id').slice(3))]));
  await f.render(); await tick(); await login(f);
  let button = f.section().querySelector('[data-action="delete-comment"]');
  assert(button);
  f.setHandler(() => reply(200, []));
  await f.click(button);
  assert(f.section().textContent.includes('一条评论'));
  assert(!f.toasts.some(t => t.type === 'success'));
  f.setHandler(() => reply(200, [{ id: 'comment-1' }]));
  button = f.section().querySelector('[data-action="delete-comment"]');
  await f.click(button);
  assert(!f.section().textContent.includes('一条评论'));
  assert(f.toasts.some(t => t.type === 'success'));
});

test('expired sessions fail closed, and write timeouts require checking before retry', async () => {
  const f = fixture(); await login(f); f.advance(3600001);
  await assert.rejects(f.context.deleteComment('comment-1'), /请先登录/);
  f.setHandler(() => new Promise(() => {}));
  const pending = f.context.addComment('memory', 'shared-id', '同学', '内容');
  const rejected = assert.rejects(pending, /结果尚未确认/);
  f.fireTimeout(8000); await rejected;
  assert.equal(f.requests.filter(r => r.method === 'POST' && r.url.pathname.endsWith('/comments')).length, 1);
});

test('both pages include the shared comments script before their renderer', () => {
  for (const category of ['photos', 'memories']) {
    const html = fs.readFileSync(path.join(project, category, 'index.html'), 'utf8');
    assert(html.indexOf('../common.js?') < html.indexOf('../comments.js?'));
    assert(html.indexOf('../comments.js?') < html.indexOf(`../${category}.js?`));
    assert(html.includes('id="comment-admin-toggle"'));
  }
});
