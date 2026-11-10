# Star SMS

客户前台和超级管理员后台采用 React、TypeScript、Vite 和 Tailwind CSS。两端共用 Node.js + Express API，使用各自的登录会话。

## 本地启动

安装 Node.js 24 或更新版本和 pnpm 11。解压后在项目目录运行：

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

| 入口 | 本地地址 | 演示账号 |
| --- | --- | --- |
| 客户前台 | http://127.0.0.1:4173/client/ | `customer` |
| 超级管理员后台 | http://127.0.0.1:4173/admin/ | `admin` |

演示密码均为 `sms-demo`。登录时输入页面上的验证码。服务只监听本机。修改代码时可运行 `pnpm dev`，运行 `pnpm typecheck` 和 `pnpm test` 验证代码。

## 数据和配置

默认不需要创建 `.env`。本地演示数据写入 `.data/demo.json`。客户提交的短信会加入演示队列，可以在后台查看。新版使用独立的数据文件，早期离线 HTML 的浏览器数据需要另行迁移。

需要连接 PostgreSQL 时，将 `.env.example` 复制为 `.env`，填写 `DATABASE_URL`，然后运行 `pnpm db:push` 创建 Drizzle 表。短信通道地址和令牌默认留空。本版使用固定演示账号，短信任务只在队列中记录。
