/** 后端错误响应契约；通过 HttpErrorResponse.error 读取。 */
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly traceId?: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
}
