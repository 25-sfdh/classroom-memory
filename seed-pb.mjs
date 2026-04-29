import http from "node:http";

const PB_URL = "http://127.0.0.1:8090";

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PB_URL);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const auth = await request("POST", "/api/collections/_superusers/auth-with-password", {
    identity: "admin@class15.com",
    password: "rhj152025",
  });
  if (auth.status !== 200) {
    console.error("Auth failed:", auth.data);
    process.exit(1);
  }
  const token = auth.data.token;
  console.log("Authenticated");

  const seedData = {
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

  for (const [collection, records] of Object.entries(seedData)) {
    console.log(`Seeding ${collection}...`);
    // Check once per collection whether any data exists
    const check = await request("GET", `/api/collections/${collection}/records?perPage=1`, null, token);
    if (check.data?.totalItems > 0) {
      console.log(`  Collection already has ${check.data.totalItems} records, skipping seed for ${collection}`);
      continue;
    }

    for (const record of records) {
      const result = await request("POST", `/api/collections/${collection}/records`, record, token);
      if (result.status === 200 || result.status === 201) {
        console.log(`  OK - ${record.title || record.name || "(no title)"}`);
      } else {
        console.log(`  FAILED: ${JSON.stringify(result.data)}`);
      }
    }
  }

  // Verify public access
  console.log("\nVerifying public read access...");
  for (const name of ["members", "photos", "activities", "messages", "news", "memories", "history"]) {
    const r = await request("GET", `/api/collections/${name}/records?perPage=3`, null, null);
    console.log(`  GET /api/collections/${name}/records: ${r.status} (${r.data?.totalItems || 0} items)`);
  }

  console.log("\nDone! Data is ready.");
}

main().catch(console.error);
