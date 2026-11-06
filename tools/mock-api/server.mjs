import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { propertyFixtures } from './fixtures.mjs';
import { parseQuery, validateProperty } from './validation.mjs';

const base = '/api/v1/properties';

function send(response, status, body) {
  response.writeHead(
    status,
    body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' },
  );
  response.end(body === undefined ? undefined : JSON.stringify(body));
}
function error(response, status, code, message, fieldErrors) {
  send(response, status, {
    code,
    message,
    traceId: randomUUID(),
    ...(fieldErrors && { fieldErrors }),
  });
}
async function readJson(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('请使用 application/json'), { status: 415 });
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw Object.assign(new Error('请求体超过 64 KiB'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON 格式错误'), { status: 400 });
  }
}

/** 创建独立内存 Mock 服务。每个实例有独立数据，重启恢复固定种子；仅供本机开发测试。 */
export function createMockApi() {
  const records = new Map(propertyFixtures().map((item) => [item.id, item]));
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/health') {
        return send(response, 200, { status: 'ok', service: 'property-mock-api' });
      }
      const collection = url.pathname === base;
      const match = url.pathname.match(/^\/api\/v1\/properties\/([^/]+)$/);
      if (!collection && !match) return error(response, 404, 'ROUTE_NOT_FOUND', '接口不存在');
      const id = match ? decodeURIComponent(match[1]) : undefined;
      const allowed = collection ? ['GET', 'POST'] : ['GET', 'PATCH', 'DELETE'];
      if (!allowed.includes(request.method)) {
        response.setHeader('Allow', allowed.join(', '));
        return error(response, 405, 'METHOD_NOT_ALLOWED', '请求方法不支持');
      }

      // GET 集合：先筛选和排序，再计算总数并分页。
      if (collection && request.method === 'GET') {
        const { page, pageSize, sortBy, sortOrder, errors } = parseQuery(url.searchParams);
        if (Object.keys(errors).length)
          return error(response, 400, 'INVALID_QUERY', '查询参数错误', errors);
        const params = url.searchParams;
        let items = [...records.values()].filter(
          (item) =>
            ['type', 'listingType', 'status'].every(
              (key) => !params.has(key) || item[key] === params.get(key),
            ) &&
            (!params.has('city') || item.address.city === params.get('city')) &&
            (!params.has('keyword') ||
              `${item.title} ${item.description}`.includes(params.get('keyword'))),
        );
        items.sort((a, b) => {
          const order = a[sortBy] < b[sortBy] ? -1 : a[sortBy] > b[sortBy] ? 1 : 0;
          return order * (sortOrder === 'asc' ? 1 : -1) || a.id.localeCompare(b.id);
        });
        return send(response, 200, {
          items: items.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          total: items.length,
        });
      }

      // POST：服务端分配 ID 与时间戳，拒绝客户端覆盖只读字段。
      if (collection && request.method === 'POST') {
        const body = await readJson(request);
        const errors = validateProperty(body);
        if (Object.keys(errors).length)
          return error(response, 422, 'VALIDATION_ERROR', '房产字段校验失败', errors);
        const timestamp = new Date().toISOString();
        const item = { ...body, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp };
        records.set(item.id, item);
        response.setHeader('Location', `${base}/${item.id}`);
        return send(response, 201, item);
      }

      const item = records.get(id);
      if (!item) return error(response, 404, 'PROPERTY_NOT_FOUND', '房产不存在');
      // GET 详情。
      if (request.method === 'GET') return send(response, 200, item);
      // PATCH：校验后合并变更，保持 ID 和创建时间不变。
      if (request.method === 'PATCH') {
        const body = await readJson(request);
        const errors = validateProperty(body, true);
        if (Object.keys(errors).length)
          return error(response, 422, 'VALIDATION_ERROR', '房产字段校验失败', errors);
        const updated = { ...item, ...body, updatedAt: new Date().toISOString() };
        records.set(id, updated);
        return send(response, 200, updated);
      }
      // DELETE：内存中删除，成功不返回响应体。
      records.delete(id);
      return send(response, 204);
    } catch (cause) {
      const status = cause instanceof URIError ? 400 : (cause.status ?? 500);
      error(
        response,
        status,
        status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
        status === 500 ? 'Mock 服务内部错误' : cause.message,
      );
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.MOCK_PORT ?? 8080);
  const server = createMockApi();
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () =>
    console.log(`Property Mock API listening on port ${server.address().port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
