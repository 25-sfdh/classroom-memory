// ── 修复 PocketBase 集合 Schema：添加缺失的字段 ──
import http from "node:http";

const PB_URL = "http://127.0.0.1:8090";

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PB_URL);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {},
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    if (body && typeof body === "object") {
      opts.headers["Content-Type"] = "application/json";
    }
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const SCHEMAS = {
  members: [
    { name: "name", type: "text", required: true },
    { name: "avatar", type: "file", maxSize: 5242880, maxSelect: 1, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
    { name: "bio", type: "text" },
    { name: "role", type: "text" },
  ],
  photos: [
    { name: "title", type: "text", required: true },
    { name: "image", type: "file", maxSize: 10485760, maxSelect: 1, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
    { name: "description", type: "text" },
    { name: "source_url", type: "url" },
  ],
  activities: [
    { name: "tag", type: "text" },
    { name: "title", type: "text", required: true },
    { name: "content", type: "text" },
    { name: "image", type: "file", maxSize: 10485760, maxSelect: 1, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
    { name: "source_url", type: "url" },
  ],
  messages: [
    { name: "name", type: "text", required: true },
    { name: "content", type: "text", required: true },
  ],
  news: [
    { name: "title", type: "text", required: true },
    { name: "date", type: "text" },
    { name: "content", type: "text" },
  ],
  memories: [
    { name: "name", type: "text" },
    { name: "content", type: "text", required: true },
  ],
  history: [
    { name: "date", type: "text" },
    { name: "title", type: "text", required: true },
    { name: "content", type: "text" },
  ],
};

const SEED = {
  memories: [
    { name: "班长", content: "最难忘的是毕业前最后一次大扫除，大家一边收拾教室，一边把黑板写满祝福。" },
    { name: "语文课代表", content: "高三的早读声、同桌递来的草稿纸、月考后的互相安慰，都值得被记住。" },
  ],
  messages: [
    { name: "老同学", content: "我现在在上海工作，十年聚会如果定在暑假，大概率可以参加。" },
  ],
  history: [
    { date: "2022-09", title: "开学与军训", content: "第一次集合、第一次点名，班级故事从这里开始。" },
    { date: "2023-10", title: "运动会总分突破", content: "接力、跳高、长跑和后勤组一起撑起了那次高光时刻。" },
    { date: "2024-12", title: "最后一次元旦晚会", content: "节目、掌声和合唱让教室变成临时舞台。" },
    { date: "2025-06", title: "毕业合影", content: "照片定格了那天的阳光，也定格了每个人的高中模样。" },
  ],
  news: [
    { date: "2026-05-01", title: "十年聚会意向征集", content: "请同学们在留言板留下所在城市和可参加时间，班委将汇总后确定地点。" },
    { date: "2026-04-20", title: "毕业照电子版整理中", content: "如果你手里有高清活动照片，可以发给资料组统一归档。" },
    { date: "2026-04-12", title: "班级通讯录更新", content: "请确认自己的邮箱、城市和常用联系方式，便于后续活动通知。" },
  ],
  activities: [
    { tag: "运动会", title: "接力赛后的拥抱", content: "不只是名次，更是一起跑完、一起喊到嗓子沙哑的下午。", source_url: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80" },
    { tag: "元旦晚会", title: "教室里的小舞台", content: "把课桌推到两边之后，整个教室都像临时搭起来的剧场。", source_url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80" },
    { tag: "毕业旅行", title: "出发那天的晴天", content: "有人拍照，有人整理零食，车刚开动，笑声就已经坐满了整排座位。", source_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80" },
  ],
  photos: [
    { title: "高2022级15班", description: "高2022级15班全班合影，属于大家的第一张首页主图。", source_url: "assets/class-photo.jpg" },
    { title: "资料组", description: "高2022级15班蹭饭指南，全班同学升学去向纪念图。", source_url: "assets/class-destination-map.jpg" },
  ],
};

async function main() {
  // Auth
  const auth = await api("POST", "/api/collections/_superusers/auth-with-password", {
    identity: "admin@class15.com",
    password: "rhj152025",
  });
  if (auth.status !== 200) {
    console.error("Auth failed:", auth.data);
    process.exit(1);
  }
  const token = auth.data.token;
  console.log("Authenticated OK\n");

  // Step 1: Add fields to each collection
  console.log("=== Adding schema fields ===");
  for (const [name, fields] of Object.entries(SCHEMAS)) {
    // Get current collection to preserve id field
    const cur = await api("GET", `/api/collections/${name}`, null, token);
    if (cur.status !== 200) {
      console.error(`  ${name}: get failed`, cur.data);
      continue;
    }

    // Build full fields array: existing system id field + new custom fields
    const existingId = cur.data.fields.find((f) => f.name === "id" && f.system);
    const fullFields = existingId ? [existingId, ...fields] : fields;

    const result = await api("PATCH", `/api/collections/${name}`, {
      fields: fullFields,
    }, token);

    if (result.status === 200) {
      const count = fields.length;
      console.log(`  ${name}: +${count} fields OK`);
    } else {
      console.error(`  ${name}: FAILED`, JSON.stringify(result.data).slice(0, 200));
    }
  }

  // Step 2: Delete all old records (they have no field data)
  console.log("\n=== Deleting old empty records ===");
  for (const name of Object.keys(SCHEMAS)) {
    const list = await api("GET", `/api/collections/${name}/records?perPage=100`, null, token);
    const items = list.data?.items || [];
    for (const item of items) {
      await api("DELETE", `/api/collections/${name}/records/${item.id}`, null, token);
    }
    if (items.length > 0) console.log(`  ${name}: deleted ${items.length} records`);
    else console.log(`  ${name}: no records to delete`);
  }

  // Step 3: Seed data
  console.log("\n=== Seeding data ===");
  for (const [collection, records] of Object.entries(SEED)) {
    for (const record of records) {
      const r = await api("POST", `/api/collections/${collection}/records`, record, token);
      if (r.status === 200 || r.status === 201) {
        console.log(`  ${collection}: ${record.title || record.name || "(record)"} OK`);
      } else {
        console.error(`  ${collection}: FAILED ${JSON.stringify(r.data).slice(0, 150)}`);
      }
    }
  }

  // Step 4: Verify
  console.log("\n=== Verification ===");
  for (const name of Object.keys(SCHEMAS)) {
    const r = await api("GET", `/api/collections/${name}/records?perPage=5`, null, null);
    if (r.status === 200) {
      const items = r.data?.items || [];
      console.log(`  ${name}: ${items.length} records (public GET ${r.status})`);
      if (items.length > 0) {
        const keys = Object.keys(items[0]).filter(k => !["id","collectionId","collectionName"].includes(k));
        console.log(`    fields: ${keys.join(", ")}`);
      }
    } else {
      console.log(`  ${name}: ERROR ${r.status}`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
