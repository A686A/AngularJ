# 房产信息 API 契约

版本：v1。基础路径 `/api/v1/properties`。使用 JSON，时间使用 UTC ISO 8601 字符串。
本契约为前后端对接约定；实际后端实现与鉴权方式需由后端确认。

| 操作     | 方法和路径                       | 成功响应                |
| -------- | -------------------------------- | ----------------------- |
| 分页查询 | `GET /api/v1/properties`         | `200`，分页结果         |
| 查询详情 | `GET /api/v1/properties/{id}`    | `200`，房产对象         |
| 新增房产 | `POST /api/v1/properties`        | `201`，创建后的房产对象 |
| 修改房产 | `PATCH /api/v1/properties/{id}`  | `200`，更新后的房产对象 |
| 删除房产 | `DELETE /api/v1/properties/{id}` | `204`，无响应体         |

字段约定：`id` 为不透明字符串；`title` 房产标题；`description` 描述；`address` 含 `province`、`city`、`district`、`street`；`type` 为 `apartment`、`house`、`commercial`；`listingType` 为 `sale` 或 `rent`；`status` 为 `draft`、`published`、`sold`、`rented`、`withdrawn`；`priceInMinorUnits` 为人民币分的非负安全整数，出售时为总价、出租时为月租；`areaSquareMeters` 为正数；`bedrooms`、`bathrooms` 为非负整数；`createdAt`、`updatedAt` 由服务端生成。

新增请求包含除 `id`、时间戳以外的业务字段；修改请求仅包含变更字段，地址若提供则整体替换。服务端必须执行字段校验、业务状态转换校验、鉴权和资源访问控制，不能仅依赖前端类型。删除的归档策略由后端决定。

分页参数：`page` 从 1 开始、默认 1；`pageSize` 默认 20、最大 100。可按 `keyword`、`type`、`listingType`、`status`、`city` 筛选。排序字段 `sortBy` 为 `createdAt`、`updatedAt` 或 `priceInMinorUnits`；`sortOrder` 为 `asc` 或 `desc`，默认按 `createdAt desc` 排序。分页响应包含 `items`、`page`、`pageSize`、`total`（筛选后的总记录数）。

错误使用对应 HTTP 状态码：400/422 校验失败、401 未登录、403 无权限、404 不存在、409 冲突、5xx 服务端异常。错误体约定为 `{ "code": "PROPERTY_NOT_FOUND", "message": "...", "traceId": "...", "fieldErrors": { "title": ["..."] } }`，后两项可选。前端保留原始 HTTP 错误供调用方处理；新增、修改、删除不会自动重试，以避免重复写入。
