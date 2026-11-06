import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api/api.config';
import {
  CreatePropertyRequest,
  Property,
  PropertyListQuery,
  PropertyPage,
  UpdatePropertyRequest,
} from '../models/property.model';

/** 房产 HTTP 对接层。返回冷 Observable，订阅才发请求；保留原始 HTTP 错误，不自动重试写操作。 */
@Injectable({ providedIn: 'root' })
export class PropertyApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL).replace(/\/+$/, '')}/properties`;

  /**
   * GET /properties：分页查询，200 返回房产列表与筛选后总数。
   * 默认第 1 页、每页 20 条、创建时间倒序；非法分页在本地通过 Observable 报错。
   */
  list(query: PropertyListQuery = {}): Observable<PropertyPage> {
    return defer(() => {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
      ) {
        throw new RangeError('page 必须为正整数，pageSize 必须为 1–100 的整数');
      }
      let params = new HttpParams()
        .set('page', page)
        .set('pageSize', pageSize)
        .set('sortBy', query.sortBy ?? 'createdAt')
        .set('sortOrder', query.sortOrder ?? 'desc');
      for (const key of ['keyword', 'type', 'listingType', 'status', 'city'] as const) {
        const value = query[key];
        if (value !== undefined && value.trim() !== '') params = params.set(key, value);
      }
      return this.http.get<PropertyPage>(this.url, { params });
    });
  }

  /** GET /properties/{id}：200 返回详情；不存在时保留后端 404 错误。 */
  getById(id: string): Observable<Property> {
    return defer(() => this.http.get<Property>(this.resourceUrl(id)));
  }

  /** POST /properties：发送完整业务字段，201 返回创建结果（含 id 和时间戳）。 */
  create(request: CreatePropertyRequest): Observable<Property> {
    return this.http.post<Property>(this.url, request);
  }

  /** PATCH /properties/{id}：仅发送修改字段，200 返回更新结果；拒绝空更新。 */
  update(id: string, request: UpdatePropertyRequest): Observable<Property> {
    return defer(() => {
      if (!Object.values(request).some((value) => value !== undefined)) {
        throw new TypeError('更新请求至少包含一个业务字段');
      }
      return this.http.patch<Property>(this.resourceUrl(id), request);
    });
  }

  /** DELETE /properties/{id}：成功为 204，无响应体；删除权限及归档由后端处理。 */
  delete(id: string): Observable<void> {
    return defer(() => this.http.delete<void>(this.resourceUrl(id)));
  }

  private resourceUrl(id: string): string {
    if (!id.trim()) throw new TypeError('房产 ID 不能为空');
    return `${this.url}/${encodeURIComponent(id)}`;
  }
}
