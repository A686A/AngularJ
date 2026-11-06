import { HttpErrorResponse, provideHttpClient, withFetch } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/api/api.config';
import { CreatePropertyRequest } from '../models/property.model';
import { PropertyApiService } from './property-api.service';

// 仅由 npm run test:integration 运行；地址来自启动器创建的隔离 Mock 实例。
declare const process: { env: Record<string, string | undefined> };
const apiUrl = process.env['MOCK_API_URL'];
if (!apiUrl) throw new Error('请通过 npm run test:integration 启动独立 Mock 后端');
const input: CreatePropertyRequest = {
  title: '集成测试 & 朝南房源',
  description: '独立测试数据',
  address: { province: '浙江省', city: '杭州市', district: '西湖区', street: '测试街 1 号' },
  type: 'house',
  listingType: 'sale',
  status: 'draft',
  priceInMinorUnits: 320000000,
  areaSquareMeters: 120,
  bedrooms: 3,
  bathrooms: 2,
};

describe('PropertyApiService + 独立 HTTP Mock 后端', () => {
  let service: PropertyApiService;
  const createdIds = new Set<string>();

  beforeEach(() => {
    // 使用真实 Fetch HTTP 后端，不注册 HttpTestingController，不拦截请求。
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), { provide: API_BASE_URL, useValue: apiUrl }],
    });
    service = TestBed.inject(PropertyApiService);
  });
  afterEach(async () => {
    for (const id of createdIds) {
      await fetch(`${apiUrl}/properties/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
    createdIds.clear();
  });

  async function create(overrides: Partial<CreatePropertyRequest> = {}) {
    const item = await firstValueFrom(service.create({ ...input, ...overrides }));
    createdIds.add(item.id);
    return item;
  }

  it('完整执行新增 → 详情 → 修改 → 查询 → 删除 → 再查 404', async () => {
    const item = await create();
    expect(item).toMatchObject(input);
    expect(item.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false);
    expect(await firstValueFrom(service.getById(item.id))).toEqual(item);

    const updated = await firstValueFrom(
      service.update(item.id, { title: '已修改房源', priceInMinorUnits: 0 }),
    );
    expect(updated.title).toBe('已修改房源');
    expect(updated.priceInMinorUnits).toBe(0);
    expect(updated.createdAt).toBe(item.createdAt);
    expect(updated.address).toEqual(item.address);
    const page = await firstValueFrom(service.list({ keyword: '已修改房源' }));
    expect(page.total).toBe(1);
    expect(page.items[0]).toEqual(updated);

    await firstValueFrom(service.delete(item.id));
    createdIds.delete(item.id);
    await expect(firstValueFrom(service.getById(item.id))).rejects.toMatchObject({
      status: 404,
      error: { code: 'PROPERTY_NOT_FOUND' },
    });
    expect((await firstValueFrom(service.list({ keyword: '已修改房源' }))).total).toBe(0);
  });

  it('通过真实查询字符串验证中文、特殊字符、组合筛选、排序和分页总数', async () => {
    const cheaper = await create({ priceInMinorUnits: 1000000 });
    const expensive = await create({ priceInMinorUnits: 2000000 });
    const query = {
      keyword: '测试 & 朝南',
      city: '杭州市',
      type: 'house',
      listingType: 'sale',
      status: 'draft',
      pageSize: 1,
      sortBy: 'priceInMinorUnits',
      sortOrder: 'asc',
    } as const;
    const first = await firstValueFrom(service.list({ ...query, page: 1 }));
    const second = await firstValueFrom(service.list({ ...query, page: 2 }));
    expect(first).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(first.items.map((item) => item.id)).toEqual([cheaper.id]);
    expect(second.items.map((item) => item.id)).toEqual([expensive.id]);
    expect((await firstValueFrom(service.list({ ...query, page: 3 }))).items).toEqual([]);
  });

  it('后端字段校验错误通过真实 Angular HttpErrorResponse 返回，且不写入无效数据', async () => {
    const before = await firstValueFrom(service.list());
    const error = await firstValueFrom(service.create({ ...input, priceInMinorUnits: -1 })).catch(
      (error: HttpErrorResponse) => error,
    );
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error).toMatchObject({
      status: 422,
      error: {
        code: 'VALIDATION_ERROR',
        fieldErrors: { priceInMinorUnits: ['字段缺失或格式不正确'] },
      },
    });
    expect((await firstValueFrom(service.list())).total).toBe(before.total);
  });

  it('失败的修改保留原数据，地址按整体替换', async () => {
    const item = await create();
    await expect(
      firstValueFrom(service.update(item.id, { areaSquareMeters: 0 })),
    ).rejects.toMatchObject({ status: 422 });
    expect(await firstValueFrom(service.getById(item.id))).toEqual(item);
    const address = {
      province: '江苏省',
      city: '南京市',
      district: '鼓楼区',
      street: '测试街 2 号',
    };
    const updated = await firstValueFrom(service.update(item.id, { address }));
    expect(updated.address).toEqual(address);
    expect(updated.title).toBe(item.title);
  });

  it('不存在的资源：查询、修改、删除均返回 404', async () => {
    await expect(firstValueFrom(service.getById('missing-id'))).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      firstValueFrom(service.update('missing-id', { title: '更新' })),
    ).rejects.toMatchObject({ status: 404 });
    await expect(firstValueFrom(service.delete('missing-id'))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('Mock 拒绝非法 JSON、只读字段、非法分页和不支持的方法', async () => {
    const invalidJson = await fetch(`${apiUrl}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(invalidJson.status).toBe(400);
    const readOnly = await fetch(`${apiUrl}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, id: 'forged' }),
    });
    expect(readOnly.status).toBe(422);
    expect((await readOnly.json()).fieldErrors.id).toBeDefined();
    expect((await fetch(`${apiUrl}/properties?pageSize=101`)).status).toBe(400);
    const unsupported = await fetch(`${apiUrl}/properties`, { method: 'PUT' });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get('Allow')).toBe('GET, POST');
  });

  it('DELETE 实际返回 204 和空响应体', async () => {
    const item = await create();
    const response = await fetch(`${apiUrl}/properties/${item.id}`, { method: 'DELETE' });
    createdIds.delete(item.id);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });
});
