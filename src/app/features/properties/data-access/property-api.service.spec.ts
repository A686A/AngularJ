import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/api/api.config';
import { ApiError } from '../../../core/api/api-error.model';
import { CreatePropertyRequest, Property } from '../models/property.model';
import { PropertyApiService } from './property-api.service';

const baseUrl = '/api/v1/properties';
const input: CreatePropertyRequest = {
  title: '朝南两居室',
  description: '近地铁',
  address: { province: '浙江省', city: '杭州市', district: '西湖区', street: '文一路 1 号' },
  type: 'apartment',
  listingType: 'sale',
  status: 'draft',
  priceInMinorUnits: 300000000,
  areaSquareMeters: 89.5,
  bedrooms: 2,
  bathrooms: 1,
};
const property: Property = {
  ...input,
  id: 'property-1',
  createdAt: '2026-11-06T00:00:00Z',
  updatedAt: '2026-11-06T00:00:00Z',
};

describe('PropertyApiService', () => {
  let service: PropertyApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PropertyApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('使用默认分页和排序，返回服务端分页数据', async () => {
    const result = firstValueFrom(service.list());
    const req = http.expectOne((r) => r.url === baseUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.get('sortBy')).toBe('createdAt');
    expect(req.request.params.get('sortOrder')).toBe('desc');
    const page = { items: [property], page: 1, pageSize: 20, total: 1 };
    req.flush(page);
    expect(await result).toEqual(page);
  });

  it('完整传递筛选条件、中文和特殊字符以及自定义分页排序', async () => {
    const query = {
      page: 2,
      pageSize: 100,
      keyword: '地铁 & 学区',
      city: '杭州市',
      type: 'apartment',
      listingType: 'sale',
      status: 'published',
      sortBy: 'priceInMinorUnits',
      sortOrder: 'asc',
    } as const;
    const result = firstValueFrom(service.list(query));
    const req = http.expectOne((r) => r.url === baseUrl);
    for (const [key, value] of Object.entries(query))
      expect(req.request.params.get(key)).toBe(String(value));
    req.flush({ items: [], page: 2, pageSize: 100, total: 0 });
    expect((await result).items).toEqual([]);
  });

  it('忽略空白筛选项', async () => {
    const result = firstValueFrom(service.list({ keyword: ' ', city: '' }));
    const req = http.expectOne((r) => r.url === baseUrl);
    expect(req.request.params.has('keyword')).toBe(false);
    expect(req.request.params.has('city')).toBe(false);
    req.flush({ items: [], page: 1, pageSize: 20, total: 0 });
    await result;
  });

  it.each([
    { page: 0 },
    { page: 1.5 },
    { page: NaN },
    { pageSize: 0 },
    { pageSize: 101 },
    { pageSize: Infinity },
  ])('非法分页不发送 HTTP 请求：%o', async (query) => {
    await expect(firstValueFrom(service.list(query))).rejects.toBeInstanceOf(RangeError);
    http.expectNone((r) => r.url === baseUrl);
  });

  it('详情查询编码 ID，避免路径或查询参数注入', async () => {
    const result = firstValueFrom(service.getById('楼/1?x=2'));
    const req = http.expectOne(`${baseUrl}/${encodeURIComponent('楼/1?x=2')}`);
    expect(req.request.method).toBe('GET');
    req.flush(property);
    expect(await result).toEqual(property);
  });

  it('新增发送完整请求并返回 201 创建结果', async () => {
    const result = firstValueFrom(service.create(input));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush(property, { status: 201, statusText: 'Created' });
    expect(await result).toEqual(property);
  });

  it('修改使用 PATCH 且不补齐未修改字段', async () => {
    const changes = { priceInMinorUnits: 0, description: '' };
    const result = firstValueFrom(service.update(property.id, changes));
    const req = http.expectOne(`${baseUrl}/${property.id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(changes);
    req.flush({ ...property, ...changes });
    expect(await result).toEqual({ ...property, ...changes });
  });

  it.each([{}, { title: undefined }])('拒绝没有变更字段的更新：%o', async (changes) => {
    await expect(firstValueFrom(service.update(property.id, changes))).rejects.toBeInstanceOf(
      TypeError,
    );
    http.expectNone((r) => r.url.startsWith(baseUrl));
  });

  it('删除使用 DELETE，接受 204 无响应体', async () => {
    const result = firstValueFrom(service.delete(property.id));
    const req = http.expectOne(`${baseUrl}/${property.id}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await result;
  });

  it.each(['detail', 'update', 'delete'])('%s 拒绝空白 ID', async (operation) => {
    const result =
      operation === 'detail'
        ? service.getById(' ')
        : operation === 'update'
          ? service.update(' ', { title: '更新' })
          : service.delete(' ');
    await expect(firstValueFrom<unknown>(result)).rejects.toBeInstanceOf(TypeError);
    http.expectNone((r) => r.url.startsWith(baseUrl));
  });

  it.each([
    ['list', 500],
    ['detail', 404],
    ['create', 422],
    ['update', 409],
    ['delete', 403],
  ] as const)('%s 保留 HTTP %i 和业务错误且不自动重试', async (operation, status) => {
    const call =
      operation === 'list'
        ? service.list()
        : operation === 'detail'
          ? service.getById(property.id)
          : operation === 'create'
            ? service.create(input)
            : operation === 'update'
              ? service.update(property.id, { title: '更新' })
              : service.delete(property.id);
    const errorBody: ApiError = { code: 'PROPERTY_ERROR', message: '请求失败', traceId: 'trace-1' };
    const result = firstValueFrom<unknown>(call).catch((error: HttpErrorResponse) => error);
    http
      .expectOne((r) => r.url.startsWith(baseUrl))
      .flush(errorBody, { status, statusText: 'Error' });
    const error = (await result) as HttpErrorResponse;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error.status).toBe(status);
    expect(error.error).toEqual(errorBody);
    http.expectNone((r) => r.url.startsWith(baseUrl));
  });

  it('保留网络错误', async () => {
    const result = firstValueFrom(service.getById(property.id)).catch(
      (error: HttpErrorResponse) => error,
    );
    http.expectOne(`${baseUrl}/${property.id}`).error(new ProgressEvent('error'));
    expect(((await result) as HttpErrorResponse).status).toBe(0);
  });

  it('允许覆盖 API 基址并移除尾部斜杠', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/custom/api/' },
      ],
    });
    service = TestBed.inject(PropertyApiService);
    http = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(service.getById(property.id));
    http.expectOne(`/custom/api/properties/${property.id}`).flush(property);
    expect(await result).toEqual(property);
  });
});
