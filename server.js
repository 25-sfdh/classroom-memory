/**
 * 后端现已迁移至 PocketBase。
 * PocketBase 是一个单二进制 Go 程序，内置 SQLite + REST API + 文件存储。
 *
 * 启动方式（开发环境）：
 *   pocketbase.exe serve --dev
 *
 * 启动后访问：
 *   管理后台: http://127.0.0.1:8090/_/
 *   数据 API: http://127.0.0.1:8090/api/collections/{collection}/records
 *
 * 管理员账号（预设）：
 *   用户: admin@class15.com
 *   密码: rhj152025
 *
 * 如需部署到生产环境，请参考 PocketBase 官方文档。
 */
console.log("PocketBase 后端已启用。请运行 `pocketbase.exe serve --dev` 启动服务。");
