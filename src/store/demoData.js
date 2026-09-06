// 演示数据（访客模式只读浏览用）
export const DEFAULT_SCHEMA = {
  id: 'default',
  name: '默认 Schema',
  description: '基础城市更新案例拆解框架',
  entityTypes: [
    { id: 'e1', name: '项目主体', color: '#3b82f6', properties: [
      { name: '名称', type: 'text' },
      { name: '类型', type: 'enum', options: ['企业', '政府', '个人'] },
      { name: '角色', type: 'text' }
    ]},
    { id: 'e2', name: '改造方式', color: '#10b981', properties: [
      { name: '模式', type: 'text' },
      { name: '周期', type: 'text' }
    ]},
    { id: 'e3', name: '地块属性', color: '#f59e0b', properties: [
      { name: '面积', type: 'number' },
      { name: '用地性质', type: 'enum', options: ['商业', '住宅', '工业', '混合'] },
      { name: '容积率', type: 'number' }
    ]},
    { id: 'e4', name: '资金来源', color: '#8b5cf6', properties: [
      { name: '类型', type: 'enum', options: ['国有资本', '民营资本', '外资', '混合'] },
      { name: '金额', type: 'number' },
      { name: '占比', type: 'text' }
    ]},
  ],
  relations: [
    { id: 'r1', name: '主导', from: '项目主体', to: '项目主体', direction: 'directed', color: '#3b82f6', style: 'solid', properties: [] },
    { id: 'r2', name: '采用', from: '项目主体', to: '改造方式', direction: 'directed', color: '#10b981', style: 'solid', properties: [] },
    { id: 'r3', name: '位于', from: '项目主体', to: '地块属性', direction: 'directed', color: '#f59e0b', style: 'solid', properties: [] },
    { id: 'r4', name: '投资于', from: '资金来源', to: '项目主体', direction: 'directed', color: '#8b5cf6', style: 'solid', properties: [] },
  ],
};

// 默认案例数据
export const DEFAULT_CASES = [
  {
    id: 'case1',
    name: '上海新天地改造项目',
    location: '上海市黄浦区',
    year: '2000',
    description: '上海新天地是一个成功的城市更新案例，将传统的石库门建筑改造为现代化的商业、娱乐和餐饮中心。',
    tags: ['工业遗产改造', '商业开发', '历史保护'],
    schemaId: 'default',
    entities: [
      { id: 'e1', name: '锦江集团', entityType: '项目主体', properties: { 类型: '企业', 角色: '开发商' } },
      { id: 'e2', name: '石库门改造', entityType: '改造方式', properties: { 模式: '保护性开发', 周期: '3 年' } },
      { id: 'e3', name: '太平桥地块', entityType: '地块属性', properties: { 面积: '52000㎡', 用地性质: '商业', 容积率: '2.5' } },
      { id: 'e4', name: '政府投资平台', entityType: '资金来源', properties: { 类型: '国有资本', 金额: '5 亿', 占比: '60%' } },
    ],
    relations: [
      { id: 'r1', name: '主导', sourceId: 'e1', targetId: 'e2' },
      { id: 'r2', name: '位于', sourceId: 'e1', targetId: 'e3' },
      { id: 'r3', name: '投资于', sourceId: 'e4', targetId: 'e1' },
    ],
  },
  {
    id: 'case2',
    name: '北京 798 艺术区',
    location: '北京市朝阳区',
    year: '2002',
    description: '由废弃的军工厂房改造而成的当代艺术聚集区，成为中国艺术地标。',
    tags: ['文创园区', '艺术改造', '政府主导'],
    schemaId: 'default',
    entities: [
      { id: 'e5', name: '七星华电集团', entityType: '项目主体', properties: { 类型: '企业', 角色: '产权方' } },
      { id: 'e6', name: '艺术园区改造', entityType: '改造方式', properties: { 模式: '文创转型', 周期: '5 年' } },
      { id: 'e7', name: '大山子地块', entityType: '地块属性', properties: { 面积: '600000㎡', 用地性质: '工业', 容积率: '1.2' } },
      { id: 'e8', name: '朝阳区文化产业基金', entityType: '资金来源', properties: { 类型: '国有资本', 金额: '2 亿', 占比: '40%' } },
    ],
    relations: [
      { id: 'r4', name: '主导', sourceId: 'e5', targetId: 'e6' },
      { id: 'r5', name: '位于', sourceId: 'e5', targetId: 'e7' },
      { id: 'r6', name: '投资于', sourceId: 'e8', targetId: 'e5' },
    ],
  },
];

