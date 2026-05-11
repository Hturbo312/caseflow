/**
 * 案例管理模块常量配置
 * 统一管理状态、表单默认值、Tab 枚举等常量
 */

/**
 * 案例状态枚举
 * @constant {Object}
 * @property {string} PLANNING - 规划中：案例尚未添加实体
 * @property {string} ACTIVE - 进行中：案例已添加实体但无关系
 * @property {string} COMPLETED - 已完成：案例已添加实体和关系
 */
export const CASE_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  COMPLETED: 'completed'
};

/**
 * 案例状态列表（用于下拉选择、状态筛选等）
 * @constant {Array<{value: string, label: string, className: string}>}
 */
export const CASE_STATUS_LIST = [
  { value: CASE_STATUS.PLANNING, label: '规划中', className: 'planning' },
  { value: CASE_STATUS.ACTIVE, label: '进行中', className: 'active' },
  { value: CASE_STATUS.COMPLETED, label: '已完成', className: 'completed' }
];

/**
 * 案例详情页 Tab 枚举
 * @constant {Object}
 * @property {string} RESULTS - 拆解结果 Tab
 * @property {string} MANUAL - 手动编辑 Tab
 */
export const CASE_DETAIL_TABS = {
  RESULTS: 'results',
  MANUAL: 'manual'
};

/**
 * 案例详情页 Tab 配置（用于渲染 Tab 列表）
 * @constant {Array<{id: string, label: string, icon: string}>}
 */
export const CASE_DETAIL_TAB_CONFIG = [
  { id: CASE_DETAIL_TABS.RESULTS, label: '拆解结果', icon: 'CheckCircle' },
  { id: CASE_DETAIL_TABS.MANUAL, label: '手动编辑', icon: 'Edit2' }
];

/**
 * 创建案例表单默认值（简化版）
 * 用于 CaseListPanel 和 CreateCaseModal
 * @constant {Object}
 */
export const DEFAULT_CASE_FORM = {
  name: '',
  description: ''
};

/**
 * 创建案例表单默认值（完整版）
 * 用于 CaseDetail 中的案例创建
 * @constant {Object}
 */
export const DEFAULT_CASE_FORM_FULL = {
  name: '',
  location: '',
  year: '',
  description: '',
  tags: []
};

/**
 * 新实体表单默认值
 * @constant {Object}
 */
export const DEFAULT_ENTITY_FORM = {
  name: '',
  entityType: '',
  properties: {}
};

/**
 * 新关系表单默认值
 * @constant {Object}
 */
export const DEFAULT_RELATION_FORM = {
  name: '',
  sourceId: '',
  targetId: ''
};

/**
 * 案例列表视图模式
 * @constant {Object}
 * @property {string} GLOBAL - 全局视图：显示所有案例数据
 * @property {string} FOCUSED - 聚焦视图：仅显示选中案例的数据
 */
export const VIEW_MODES = {
  GLOBAL: 'global',
  FOCUSED: 'focused'
};

/**
 * 案例排序选项
 * @constant {Array<{value: string, label: string}>}
 */
export const CASE_SORT_OPTIONS = [
  { value: 'updatedAt', label: '最近更新' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'name', label: '名称' },
  { value: 'status', label: '状态' }
];

/**
 * 案例 API 端点配置
 * @constant {Object}
 */
export const CASE_API_ENDPOINTS = {
  BASE: '/api/cases',
  CREATE: '/api/cases',
  LIST: '/api/cases',
  DETAIL: (id) => `/api/cases/${id}`,
  UPDATE: (id) => `/api/cases/${id}`,
  DELETE: (id) => `/api/cases/${id}`,
  ENTITIES: (caseId) => `/api/cases/${caseId}/entities`,
  RELATIONS: (caseId) => `/api/cases/${caseId}/relations`
};

/**
 * 默认显示的标签数量限制
 * @constant {number}
 */
export const MAX_VISIBLE_TAGS = 4;

/**
 * 案例名称最大长度
 * @constant {number}
 */
export const MAX_CASE_NAME_LENGTH = 100;

/**
 * 案例描述最大长度
 * @constant {number}
 */
export const MAX_CASE_DESCRIPTION_LENGTH = 2000;

/**
 * 案例文本提取字符数限制
 * @constant {number}
 */
export const MAX_EXTRACTION_TEXT_LENGTH = 500;