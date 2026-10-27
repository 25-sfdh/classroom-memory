# 评论功能部署与验收

评论从照片、回忆主体中独立加载，8 秒超时后可单独重试。读取失败不会显示为“没有评论”，刷新失败时保留上次评论及输入草稿。创建和删除均要求数据库返回实际影响的记录，HTTP 2xx 本身不会触发成功提示。请求超时后不自动重试写入，避免重复评论。

## 1. 核实部署项目与现有表

`common.js` 当前连接的 Supabase 项目是 `emonrzvnfgqzlnsmewpy`。Deploy Preview 与正式页面读取相同配置；它们并不是相互隔离的数据库。先核实目标项目，在测试项目完成以下步骤。不要在预览页面随意写入真实班级数据。

在 Supabase SQL Editor 执行只读文件 [`comments-preflight.sql`](../supabase/comments-preflight.sql)，检查现有 comments 表、父记录 ID 类型、RLS 和 grants。

迁移文件 [`202610270001_comments.sql`](../supabase/migrations/202610270001_comments.sql) 定义：

| 字段 | 类型和约束 |
| --- | --- |
| id | UUID 主键，数据库自动生成 |
| target_type | text，仅 `photo` / `memory` |
| target_id | text，父记录 ID 的字符串形式，1–128 字符 |
| name | text，非空，1–80 字符 |
| content | text，非空，1–2000 字符 |
| created_at | timestamptz，非空，默认 now() |

现有表类型不兼容、有额外列、没有 id 主键、存在未管理的 RLS 策略或不满足约束的旧数据时，迁移会报错并回滚。不要通过删表来消除报错；应根据预检结果单独准备兼容迁移。脚本不会转换、删除旧评论。重复执行兼容迁移是允许的。

本变更允许匿名读取和发表评论；站点现有前端访问密码不是数据库权限边界。评论保留此公开读写模式。若班级评论应仅成员可见，应另行引入成员登录及对应读写策略，不能仅靠页面密码。

## 2. 配置评论管理员

评论管理使用 Supabase Auth 的邮箱与密码登录，独立于站点原有的本地“管理员模式”。浏览器仅在当前页面内存中保存短期 access token，不保存密码或 refresh token；刷新或退出页面后需重新登录。

1. 在 Supabase Auth 中为经确认的管理员创建或选定用户，确认邮箱登录可用；不要把站点源码里的旧管理员密码当作新账号密码。
2. 由项目管理员给该用户的 **app_metadata** 添加布尔值 `comments_admin: true`。不能放在用户可自行编辑的 user_metadata 中。可通过受信任服务端的 [Admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) 更新，并保留其已有 app_metadata。
3. 用户重新登录以获取含新权限的 JWT，点击照片／回忆页面的“评论管理”。普通账号会得到无权限提示。

RLS 只允许经过 Supabase 验证、带该 app_metadata 标记的 authenticated 用户删除。anon 没有 DELETE grant，普通 authenticated 用户删除零行。前端没有 service_role key，也不调用旧 `server.js` 删除接口。

退出评论管理会清除当前页面的 token。已经签发的 JWT 在过期前仍有效；撤权时需考虑 JWT 有效期并按项目会话策略处理。登录账号启用了 MFA 或 CAPTCHA 等额外要求时，需先适配相应登录流程；当前表单仅支持邮箱密码登录。

参考：[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[密码登录](https://supabase.com/docs/guides/auth/passwords)。

## 3. 合并／上线前最小验收

- 在目标数据库核实迁移执行成功、默认值有效、RLS 已启用，无额外开放删除的策略。
- 照片与回忆各建一条测试评论，刷新后内容、时间与归属正确；两个类型使用相同 target_id 时不能串评论。
- 普通匿名请求不得删除；普通登录用户不得删除；评论管理员删除后返回恰好一条 id，刷新后该行确实消失。前端伪造 sessionStorage 的管理员开关不能获得评论删除权限。
- 模拟评论 400/401/403/404/500、离线、超时及异常响应：主体立即显示，评论显示失败提示并能重试，草稿保留。创建／删除响应不确定时不提示成功，也不自动重复写入。
- 检查新页面加载顺序为 common.js → comments.js → photos.js / memories.js，并确认 Netlify 实际部署的是 PR 最新提交。

自动测试使用 `npm ci && npm test`，包含模拟 DOM、网络故障与隔离 PostgreSQL（PGlite）上的真实 SQL/RLS 执行。它们不能证明线上迁移已执行、账号权限已设置或 Netlify 与 Supabase 已完成联调；Netlify 部署成功也不等于数据库验收通过。

## 范围与后续事项

- 回忆正文原有 `item.text || item.content` 保持不变。
- 原有照片、回忆等主体内容的管理员删除机制未在本次全面迁移；本次真实鉴权只覆盖评论。
- target_type / target_id 是多态关联；本迁移未增加父记录删除时的级联清理。清理孤立评论及大规模评论分页可另行实施。
- Netlify 不会因为仓库存在 SQL 文件就自动执行数据库迁移；需要在已核实的目标项目中执行。
