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
`proxy.conf.json` 将开发环境的 `/api/**` 转发到 `http://127.0.0.1:8080`，保留完整路径。按实际后端地址修改代理后重启开发服务。当前没有附带生产后端；房产 API 的开发联调可使用下文的 Mock 服务。

生产环境部署构建产物，由 Web 服务器将 `/api` 转发到实际后端，并将前端路由回退到 `index.html`。开发代理不会包含在生产构建中。不要把后端密钥放入前端代码。

## 项目结构

- `src/app/app.*`：应用入口组件
- `src/app/app.routes.ts`：页面路由
- `src/app/app.config.ts`：全局依赖配置
- `proxy.conf.json`：开发环境后端代理

云任务使用现有检出目录 `/workspace/AngularJ`，无需创建 Git worktree。

## 房产模块

接口服务位于 `src/app/features/properties/data-access/property-api.service.ts`，通过依赖注入使用 `PropertyApiService`，所有方法返回 Observable，由调用方订阅。房产类型和请求/响应契约位于同模块的 `models/property.model.ts`；通用 API 基址、错误类型位于 `src/app/core/api`。测试与被测服务就近放置，文件使用 kebab-case 命名。

提供 `list`、`getById`、`create`、`update`、`delete`。默认使用 `/api/v1/properties`，可通过 `{ provide: API_BASE_URL, useValue: '/your/api/v1' }` 在应用 providers 中覆盖基址。API 方法包含用途与 HTTP 行为注释。详细字段、分页、状态码和后端责任见 [房产 API 契约](docs/property-api.md)。

单元测试使用 Angular HttpTestingController，无需真实后端，验证请求方法/路径/载荷、分页筛选、非法输入、错误透传及配置覆盖。运行 `npm test -- --watch=false`。这些测试不代表真实后端已经实现或联调通过。TypeScript 类型不提供运行时响应校验；后端仍必须校验业务字段、权限和状态转换。当前模块不包含房产页面、鉴权或数据库。

## 使用 Mock 后端联调

打开两个终端，在项目根目录分别执行：

```sh
# 终端 1：仅监听本机的独立 Mock API（默认端口 8080）
npm run mock:api
# 终端 2：Angular 开发服务，通过已有 /api 代理访问 Mock
npm start
```

Mock 包含两条示例房源，支持真实 HTTP 增删改查、分页、筛选、排序、JSON/字段校验、404/405/422 等错误。数据仅保存在内存，重启恢复种子。`MOCK_PORT` 可覆盖端口，但需同步调整 `proxy.conf.json`。Mock 不用于生产，不包含真实数据库、鉴权或完整业务状态机。

自动验证前端 API 服务与 Mock 的完整链路：

```sh
npm run test:integration
```

启动器会自动创建独立 Mock 实例，使用系统分配的临时端口，然后运行 Angular 真实 HttpClient 集成测试，退出时关闭服务。不需要先手动启动 Mock，不占用开发用 8080 端口，也不修改开发数据。集成测试文件使用 `.integration.ts` 后缀，由独立 tsconfig 编译，不进入生产构建或默认单元测试。

测试分层：`npm test -- --watch=false` 是隔离 HTTP 单元测试；`npm run test:integration` 是真实 HTTP 的 API 服务集成测试。当前还没有房产页面，因此这不属于浏览器页面端到端测试；真实后端交付后还需要进行契约校验和真实后端联调。

Mock 文件位于 `tools/mock-api`（种子数据、校验、HTTP 服务分开），集成测试启动器位于 `tools/testing`。无需安装额外依赖。
