import { InjectionToken } from '@angular/core';

/** 业务 API 根路径；可在应用 providers 中覆盖，保持服务与部署地址解耦。 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api/v1',
});
