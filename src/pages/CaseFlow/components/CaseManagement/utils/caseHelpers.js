/**
 * 案例辅助函数
 * 提供案例状态管理、格式化、验证等工具函数
 */

import { zh, en } from '../../../../../i18n/translations';

// 非组件模块：直接读 localStorage 的 locale（与 store / ErrorBoundary 的模式一致）
const tr = (key, params) => {
  const locale = localStorage.getItem('caseflow_locale') || 'zh';
  let str = (locale === 'en' ? en[key] : zh[key]) || key;
  if (params) {
    Object.keys(params).forEach((k) => {
      str = str.replace(`{${k}}`, params[k]);
    });
  }
  return str;
};

// ==================== 状态相关 ====================

/**
 * 案例状态常量
 * @constant {Object}
 */
export const CASE_STATUS = {
  /** 规划中 - 案例尚未添加实体 */
  PLANNING: 'planning',
  /** 进行中 - 案例已添加实体但无关系 */
  ACTIVE: 'active',
  /** 已完成 - 案例已添加实体和关系 */
  COMPLETED: 'completed'
};

/**
 * 案例状态列表（用于下拉选择等场景；label 为 i18n key，渲染处需用 t() 转换）
 * @constant {Array<{value: string, label: string, className: string}>}
 */
export const CASE_STATUS_LIST = [
  { value: CASE_STATUS.PLANNING, label: 'case.planning', className: 'planning' },
  { value: CASE_STATUS.ACTIVE, label: 'case.inProgress', className: 'active' },
  { value: CASE_STATUS.COMPLETED, label: 'case.completed', className: 'completed' }
];

/**
 * 获取状态对应的 i18n key（渲染处需用 t() 转换）
 * @param {string} status - 案例状态值
 * @returns {string} 状态的 i18n key
 */
export const getStatusText = (status) => {
  const keyMap = {
    [CASE_STATUS.ACTIVE]: 'case.inProgress',
    [CASE_STATUS.COMPLETED]: 'case.completed',
    [CASE_STATUS.PLANNING]: 'case.planning'
  };
  return keyMap[status] || 'case.planning';
};

/**
 * 根据案例数据计算其状态
 * @param {Object} caseItem - 案例对象
 * @returns {string} 计算得出的状态值
 */
export const getCaseStatus = (caseItem) => {
  if (!caseItem?.entities || caseItem.entities.length === 0) {
    return CASE_STATUS.PLANNING;
  }
  if (caseItem.relations && caseItem.relations.length > 0) {
    return CASE_STATUS.COMPLETED;
  }
  return CASE_STATUS.ACTIVE;
};

// ==================== 格式化相关 ====================

/**
 * 格式化案例日期
 * @param {string|Date|number} date - 日期值
 * @param {Object} options - 格式化选项
 * @param {string} [options.format='year'] - 格式类型: 'year' | 'full' | 'relative'
 * @param {string} [options.fallback] - 空值时的默认文本（缺省为 'case.unknownYear' 的译文）
 * @returns {string} 格式化后的日期字符串
 * @example
 * formatCaseDate('2024') // 返回 '2024'
 * formatCaseDate(new Date(), { format: 'full' }) // 返回 '2024年1月1日'
 */
export const formatCaseDate = (date, options = {}) => {
  const { format = 'year', fallback } = options;
  const fb = () => (fallback != null ? fallback : tr('case.unknownYear'));

  if (!date) return fb();

  try {
    const dateObj = typeof date === 'string' && /^\d{4}$/.test(date)
      ? new Date(parseInt(date), 0, 1)
      : new Date(date);

    if (isNaN(dateObj.getTime())) return fb();

    switch (format) {
      case 'year':
        return dateObj.getFullYear().toString();
      case 'full':
        return tr('time.fullDate', { y: dateObj.getFullYear(), m: dateObj.getMonth() + 1, d: dateObj.getDate() });
      case 'relative':
        return formatRelativeDate(dateObj);
      default:
        return dateObj.getFullYear().toString();
    }
  } catch {
    return fb();
  }
};

/**
 * 格式化相对日期
 * @param {Date} date - 日期对象
 * @returns {string} 相对日期字符串
 */
const formatRelativeDate = (date) => {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return tr('time.yearsAgo', { count: diffYears });
  if (diffMonths > 0) return tr('time.monthsAgo', { count: diffMonths });
  if (diffDays > 0) return tr('session.daysAgoShort', { count: diffDays });
  return tr('session.today');
};

/**
 * 格式化案例地点
 * @param {string|Object} location - 地点字符串或案例对象
 * @param {Object} [options] - 格式化选项（当第一个参数是字符串时）
   * @param {string} [options.fallback] - 空值时的默认文本（缺省为 'case.unknownLocation' 的译文）
 * @param {boolean} [options.short=false] - 是否使用短格式（只显示城市）
 * @param {string} [options.yearFallback='未知年份'] - 年份的默认文本（仅当传入案例对象时使用）
 * @returns {string|{location: string, year: string}} 格式化后的地点字符串或包含地点和年份的对象
 * @example
 * formatCaseLocation('上海市黄浦区') // 返回 '上海市黄浦区'
 * formatCaseLocation('上海市黄浦区', { short: true }) // 返回 '上海'
 * formatCaseLocation(null) // 返回 '未知地点'
 * // 传入案例对象时返回组合字符串
 * formatCaseLocation({ location: '上海', year: '2024' }) // 返回 '上海 · 2024'
 */
export const formatCaseLocation = (location, options = {}) => {
  // 支持传入案例对象
  if (location && typeof location === 'object' && !options.fallback) {
    const caseItem = location;
    const loc = caseItem.location || tr('case.unknownLocation');
    const year = caseItem.year || tr('case.unknownYear');
    return `${loc} · ${year}`;
  }

  const { fallback, short = false } = options;

  if (!location) return fallback != null ? fallback : tr('case.unknownLocation');

  if (short) {
    // 提取城市名称（去掉省市后缀）
    const cityMatch = location.match(/(.+?)(?:市|省|自治区|特别行政区)/);
    if (cityMatch) {
      return cityMatch[1];
    }
  }

  return location;
};

/**
 * 计算图谱拓扑指标（密度、平均度、完整度）
 * @param {number} entityCount - 实体数量
 * @param {number} relationCount - 关系数量
 * @returns {{avgDegree: string|number, density: string|number, completeness: number}} 拓扑指标
 */
export const calculateTopologyMetrics = (entityCount, relationCount) => {
  const avgDegree = entityCount > 0 ? (relationCount * 2 / entityCount).toFixed(1) : 0;
  const density = entityCount > 1
    ? Math.min(1, (relationCount / (entityCount * (entityCount - 1) / 2)).toFixed(2))
    : 0;
  const completeness = entityCount > 0 ? Math.min(100, Math.round((relationCount / entityCount) * 50)) : 0;
  return { avgDegree, density, completeness };
};

// ==================== 验证相关 ====================

/**
 * 验证案例表单数据
 * @param {Object} form - 表单数据对象
 * @param {string} form.name - 案例名称
 * @param {string} [form.description] - 案例描述
 * @param {string} [form.location] - 案例地点
 * @param {string} [form.year] - 案例年份
 * @returns {{valid: boolean, errors: string[]}} 验证结果对象
 * @example
 * validateCaseForm({ name: '测试案例' }) // 返回 { valid: true, errors: [] }
 * validateCaseForm({ name: '' }) // 返回 { valid: false, errors: ['validation.caseNameRequired'] }
 */
export const validateCaseForm = (form) => {
  const errors = [];

  // 名称验证（必填）
  if (!form?.name?.trim()) {
    errors.push(tr('validation.caseNameRequired'));
  }

  // 年份验证（如果提供了年份，验证格式）
  if (form?.year && !/^\d{4}$/.test(form.year.trim())) {
    errors.push(tr('validation.yearInvalid'));
  }

  // 名称长度验证
  if (form?.name && form.name.length > 100) {
    errors.push(tr('validation.caseNameTooLong'));
  }

  // 描述长度验证
  if (form?.description && form.description.length > 2000) {
    errors.push(tr('validation.caseDescTooLong'));
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// ==================== 统计相关 ====================

/**
 * 获取案例实体和关系统计信息
 * @param {Object} caseItem - 案例对象
 * @returns {{entityCount: number, relationCount: number, hasContent: boolean}} 统计信息
 * @example
 * getCaseStats({ entities: [1,2], relations: [1] }) // 返回 { entityCount: 2, relationCount: 1, hasContent: true }
 */
export const getCaseStats = (caseItem) => {
  const entityCount = caseItem?.entities?.length || 0;
  const relationCount = caseItem?.relations?.length || 0;

  return {
    entityCount,
    relationCount,
    hasContent: entityCount > 0 || relationCount > 0
  };
};