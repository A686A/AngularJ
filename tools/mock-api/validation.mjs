const enums = {
  type: ['apartment', 'house', 'commercial'],
  listingType: ['sale', 'rent'],
  status: ['draft', 'published', 'sold', 'rented', 'withdrawn'],
};
const fields = [
  'title',
  'description',
  'address',
  ...Object.keys(enums),
  'priceInMinorUnits',
  'areaSquareMeters',
  'bedrooms',
  'bathrooms',
];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Mock 层按 API 契约校验字段；不模拟真实权限、库存或交易规则。 */
export function validateProperty(body, partial = false) {
  if (!isObject(body)) return { body: ['请求体必须为 JSON 对象'] };
  const errors = {};
  for (const key of Object.keys(body)) {
    if (!fields.includes(key)) errors[key] = ['不允许修改此字段'];
  }
  if (partial && !Object.keys(body).length) errors.body = ['至少提供一个修改字段'];
  for (const key of fields) {
    if (partial && !(key in body)) continue;
    const value = body[key];
    let valid;
    if (key === 'title') valid = typeof value === 'string' && !!value.trim() && value.length <= 200;
    else if (key === 'description') valid = typeof value === 'string' && value.length <= 5000;
    else if (key === 'address')
      valid =
        isObject(value) &&
        ['province', 'city', 'district', 'street'].every(
          (k) => typeof value[k] === 'string' && !!value[k].trim(),
        ) &&
        Object.keys(value).every((k) => ['province', 'city', 'district', 'street'].includes(k));
    else if (key in enums) valid = enums[key].includes(value);
    else if (key === 'areaSquareMeters')
      valid = typeof value === 'number' && Number.isFinite(value) && value > 0;
    else valid = Number.isSafeInteger(value) && value >= 0;
    if (!valid) errors[key] = ['字段缺失或格式不正确'];
  }
  return errors;
}

/** 验证查询参数，防止 Mock 的宽松行为掩盖客户端错误。 */
export function parseQuery(params) {
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? 20);
  const sortBy = params.get('sortBy') ?? 'createdAt';
  const sortOrder = params.get('sortOrder') ?? 'desc';
  const errors = {};
  if (!Number.isSafeInteger(page) || page < 1) errors.page = ['必须为正整数'];
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
    errors.pageSize = ['范围为 1–100'];
  if (!['createdAt', 'updatedAt', 'priceInMinorUnits'].includes(sortBy))
    errors.sortBy = ['排序字段不支持'];
  if (!['asc', 'desc'].includes(sortOrder)) errors.sortOrder = ['排序方向不支持'];
  for (const [key, values] of Object.entries(enums)) {
    if (params.has(key) && !values.includes(params.get(key))) errors[key] = ['筛选值不支持'];
  }
  return { page, pageSize, sortBy, sortOrder, errors };
}
