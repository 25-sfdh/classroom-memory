const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/202610270001_comments.sql'), 'utf8');

async function database(t) {
  const db = new PGlite();
  t.after(() => db.close());
  // Test-only Supabase role and JWT claim helpers; no live project or credentials.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select current_setting('request.jwt.claims', true)::jsonb $$;
    grant usage on schema public, auth to anon, authenticated;
  `);
  return db;
}
async function asRole(db, role, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
  await db.exec(`set role ${role}`);
}
const insert = "insert into public.comments(target_type,target_id,name,content) values ($1,$2,$3,$4) returning *";
const sub = '11111111-1111-1111-1111-111111111111';

test('real SQL: defaults, constraints, role grants and administrator-only deletion', async t => {
  const db = await database(t); await db.exec(migration); await db.exec(migration);
  await asRole(db, 'anon');
  const a = (await db.query(insert, ['photo', 'same-id', '同学', '照片评论'])).rows[0];
  const b = (await db.query(insert, ['memory', 'same-id', '同学', '回忆评论'])).rows[0];
  assert.match(a.id, /^[0-9a-f-]{36}$/); assert(a.created_at);
  assert.equal((await db.query("select * from comments where target_type='photo' and target_id='same-id'")).rows.length, 1);
  await assert.rejects(db.query('delete from comments where id=$1 returning id', [a.id]), /permission denied/);
  await assert.rejects(db.query("update comments set content='changed' where id=$1", [a.id]), /permission denied/);
  await assert.rejects(db.query("insert into comments(id,target_type,target_id,name,content) values ($1,'photo','x','n','c')", [sub]), /permission denied/);
  await assert.rejects(db.query("insert into comments(target_type,target_id,name,content,created_at) values ('photo','x','n','c',now())"), /permission denied/);
  for (const args of [['photos','x','n','c'], ['memory','','n','c'], ['memory','x',' ','c'], ['memory','x','n',' '], ['memory','x','n','x'.repeat(2001)]]) {
    await assert.rejects(db.query(insert, args), /check constraint/);
  }
  await asRole(db, 'authenticated', { sub, app_metadata: {}, user_metadata: { comments_admin: true } });
  assert.equal((await db.query('delete from comments where id=$1 returning id', [a.id])).rows.length, 0);
  assert.equal((await db.query('select * from comments')).rows.length, 2);
  await asRole(db, 'authenticated', { sub, app_metadata: { comments_admin: true } });
  assert.deepEqual((await db.query('delete from comments where id=$1 returning id', [a.id])).rows, [{ id: a.id }]);
  assert.equal((await db.query('select * from comments where id=$1', [a.id])).rows.length, 0);
  assert.equal((await db.query('select * from comments where id=$1', [b.id])).rows.length, 1);
});

test('migration refuses an incompatible existing table without changing its data', async t => {
  const db = await database(t);
  await db.exec("create table comments(id bigint primary key, content text); insert into comments values (1,'keep me')");
  await assert.rejects(db.exec(migration), /Review the existing schema/);
  await db.exec('rollback');
  assert.deepEqual((await db.query('select * from comments')).rows, [{ id: 1, content: 'keep me' }]);
});

test('migration refuses unmanaged permissive policies rather than leaving an open delete route', async t => {
  const db = await database(t); await db.exec(migration);
  await db.exec('create policy unexpected_delete on comments for delete to anon using (true)');
  await assert.rejects(db.exec(migration), /Unmanaged comments policies/);
  await db.exec('rollback');
  assert.equal((await db.query("select policyname from pg_policies where tablename='comments'")).rows.length, 4);
});
