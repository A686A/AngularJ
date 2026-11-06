/** 每次启动都重新载入的开发数据，不包含真实客户信息。 */
export function propertyFixtures() {
  return [
    {
      id: 'demo-sale-1',
      title: '西湖区朝南两居',
      description: '近地铁，采光良好',
      address: { province: '浙江省', city: '杭州市', district: '西湖区', street: '示例路 1 号' },
      type: 'apartment',
      listingType: 'sale',
      status: 'published',
      priceInMinorUnits: 300000000,
      areaSquareMeters: 89.5,
      bedrooms: 2,
      bathrooms: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'demo-rent-1',
      title: '滨江区精装公寓',
      description: '月租房源',
      address: { province: '浙江省', city: '杭州市', district: '滨江区', street: '示例路 2 号' },
      type: 'apartment',
      listingType: 'rent',
      status: 'published',
      priceInMinorUnits: 450000,
      areaSquareMeters: 55,
      bedrooms: 1,
      bathrooms: 1,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ];
}
