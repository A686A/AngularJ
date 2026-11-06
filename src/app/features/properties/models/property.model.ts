/** 房产用途。 */
export type PropertyType = 'apartment' | 'house' | 'commercial';
export type ListingType = 'sale' | 'rent';
export type PropertyStatus = 'draft' | 'published' | 'sold' | 'rented' | 'withdrawn';

export interface PropertyAddress {
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly street: string;
}

/** 创建房产的业务数据，不包含服务端分配的标识与时间戳。 */
export interface CreatePropertyRequest {
  readonly title: string;
  readonly description: string;
  readonly address: PropertyAddress;
  readonly type: PropertyType;
  readonly listingType: ListingType;
  readonly status: PropertyStatus;
  /** 人民币分，非负安全整数。出售为总价，出租为月租。 */
  readonly priceInMinorUnits: number;
  /** 建筑面积，单位平方米，必须大于零。 */
  readonly areaSquareMeters: number;
  readonly bedrooms: number;
  readonly bathrooms: number;
}

/** PATCH 仅发送变更字段；address 提供时整体替换。 */
export type UpdatePropertyRequest = Partial<CreatePropertyRequest>;

/** 服务端返回的房产信息，时间为 UTC ISO 8601。 */
export interface Property extends CreatePropertyRequest {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 分页从 1 开始，pageSize 范围为 1–100。 */
export interface PropertyListQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly keyword?: string;
  readonly type?: PropertyType;
  readonly listingType?: ListingType;
  readonly status?: PropertyStatus;
  readonly city?: string;
  readonly sortBy?: 'createdAt' | 'updatedAt' | 'priceInMinorUnits';
  readonly sortOrder?: 'asc' | 'desc';
}

export interface PropertyPage {
  readonly items: readonly Property[];
  readonly page: number;
  readonly pageSize: number;
  /** 当前筛选条件下的总记录数。 */
  readonly total: number;
}
