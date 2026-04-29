const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://emonrzvnfgqzlnsmewpy.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("错误: 请设置 SUPABASE_SERVICE_ROLE_KEY 环境变量");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(cors());
app.use(express.json());

app.delete('/api/delete/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  const allowedTables = ['members', 'photos', 'activities', 'news', 'history', 'memories', 'messages'];
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ error: '不允许的表名' });
  }
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`删除服务运行在端口 ${PORT}`);
});
