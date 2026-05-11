/**
 * 工具函数统一导出入口
 * 提供案例管理模块的所有工具函数和常量
 */

// ==================== 状态相关 ====================
export {
  CASE_STATUS,
  CASE_STATUS_LIST,
  getStatusClass,
  getStatusText,
  getCaseStatus,
  calculateCaseStatus
} from './caseHelpers';

// ==================== 格式化相关 ====================
export {
  formatCaseDate,
  formatCaseLocation,
  getCaseStats
} from './caseHelpers';

// ==================== 验证相关 ====================
export { validateCaseForm } from './caseHelpers';

// ==================== Schema 过滤相关 ====================
export {
  normalizeSchemaId,
  matchesSchemaId,
  extractSchemaId,
  caseBelongsToSchema,
  filterCasesBySchema,
  filterBySchemaId,
  findSchemaById,
  getSchemaName,
  getCaseSchemaName,
  isCaseOfSchema
} from './schemaFilter';

// ==================== 常量配置 ====================
export {
  // Tab 枚举
  CASE_DETAIL_TABS,
  CASE_DETAIL_TAB_CONFIG,
  // 表单默认值
  DEFAULT_CASE_FORM,
  DEFAULT_CASE_FORM_FULL,
  DEFAULT_ENTITY_FORM,
  DEFAULT_RELATION_FORM,
  // 视图模式
  VIEW_MODES,
  // 排序选项
  CASE_SORT_OPTIONS,
  // API 端点
  CASE_API_ENDPOINTS,
  // 限制常量
  MAX_VISIBLE_TAGS,
  MAX_CASE_NAME_LENGTH,
  MAX_CASE_DESCRIPTION_LENGTH,
  MAX_EXTRACTION_TEXT_LENGTH
} from './constants';