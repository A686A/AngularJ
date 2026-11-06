# AngularJ

使用 Angular 22 和 TypeScript 的独立前端项目，采用简单语法、独立组件和客户端路由。现代 Angular 官方工具链使用 TypeScript。

## 本地开发

需要 Node.js 24.22.1（见 `.nvmrc`）和 npm 11.9.0。

```sh
npm ci
npm start
```

开发服务默认监听 4200 端口。`npm run build` 生成 `dist/angular-j/browser`，`npm test -- --watch=false` 执行单元测试。

## 后端对接

已注册 Angular HttpClient。业务请求使用相对路径 `/api/...`。
`proxy.conf.json` 将开发环境的 `/api/**` 转发到 `http://127.0.0.1:8080`，保留完整路径。按实际后端地址修改代理后重启开发服务。当前没有附带后端或假定任何业务 API。

生产环境部署构建产物，由 Web 服务器将 `/api` 转发到实际后端，并将前端路由回退到 `index.html`。开发代理不会包含在生产构建中。不要把后端密钥放入前端代码。

## 项目结构

- `src/app/app.*`：应用入口组件
- `src/app/app.routes.ts`：页面路由
- `src/app/app.config.ts`：全局依赖配置
- `proxy.conf.json`：开发环境后端代理

云任务使用现有检出目录 `/workspace/AngularJ`，无需创建 Git worktree。
