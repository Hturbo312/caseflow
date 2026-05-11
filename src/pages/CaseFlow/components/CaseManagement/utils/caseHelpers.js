/**
 * 案例辅助函数
 * 提供案例状态管理、格式化、验证等工具函数
 */

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
 * 案例状态列表（用于下拉选择等场景）
 * @constant {Array<{value: string, label: string, className: string}>}
 */
export const CASE_STATUS_LIST = [
  { value: CASE_STATUS.PLANNING, label: '规划中', className: 'planning' },
  { value: CASE_STATUS.ACTIVE, label: '进行中', className: 'active' },
  { value: CASE_STATUS.COMPLETED, label: '已完成', className: 'completed' }
];

/**
 * 获取状态对应的 CSS 类名
 * @param {string} status - 案例状态值
 * @returns {string} 对应的 CSS 类名
 * @example
 * getStatusClass('active') // 返回 'active'
 * getStatusClass('completed') // 返回 'completed'
 * getStatusClass('unknown') // 返回 'planning' (默认)
 */
export const getStatusClass = (status) => {
  const statusMap = {
    [CASE_STATUS.ACTIVE]: 'active',
    [CASE_STATUS.COMPLETED]: 'completed',
    [CASE_STATUS.PLANNING]: 'planning'
  };
  return statusMap[status] || 'planning';
};

/**
 * 获取状态的中文显示文本
 * @param {string} status - 案例状态值
 * @returns {string} 状态的中文文本
 * @example
 * getStatusText('active') // 返回 '进行中'
 * getStatusText('completed') // 返回 '已完成'
 * getStatusText('planning') // 返回 '规划中'
 */
export const getStatusText = (status) => {
  const textMap = {
    [CASE_STATUS.ACTIVE]: '进行中',
    [CASE_STATUS.COMPLETED]: '已完成',
    [CASE_STATUS.PLANNING]: '规划中'
  };
  return textMap[status] || '规划中';
};

/**
 * 根据案例数据计算其状态
 * 这是 getCaseStatus 的别名，保持向后兼容
 * @param {Object} caseItem - 案例对象
 * @param {Array} caseItem.entities - 案例中的实体列表
 * @param {Array} caseItem.relations - 案例中的关系列表
 * @returns {string} 计算得出的状态值
 */
export const calculateCaseStatus = (caseItem) => {
  if (!caseItem?.entities || caseItem.entities.length === 0) {
    return CASE_STATUS.PLANNING;
  }
  if (caseItem.relations && caseItem.relations.length > 0) {
    return CASE_STATUS.COMPLETED;
  }
  return CASE_STATUS.ACTIVE;
};

/**
 * 根据案例数据计算其状态（主函数名）
 * @param {Object} caseItem - 案例对象
 * @param {Array} caseItem.entities - 案例中的实体列表
 * @param {Array} caseItem.relations - 案例中的关系列表
 * @returns {string} 计算得出的状态值
 * @example
 * getCaseStatus({ entities: [], relations: [] }) // 返回 'planning'
 * getCaseStatus({ entities: [{}], relations: [] }) // 返回 'active'
 * getCaseStatus({ entities: [{}], relations: [{}] }) // 返回 'completed'
 */
export const getCaseStatus = calculateCaseStatus;

// ==================== 格式化相关 ====================

/**
 * 格式化案例日期
 * @param {string|Date|number} date - 日期值
 * @param {Object} options - 格式化选项
 * @param {string} [options.format='year'] - 格式类型: 'year' | 'full' | 'relative'
 * @param {string} [options.fallback='未知年份'] - 空值时的默认文本
 * @returns {string} 格式化后的日期字符串
 * @example
 * formatCaseDate('2024') // 返回 '2024'
 * formatCaseDate(new Date(), { format: 'full' }) // 返回 '2024年1月1日'
 */
export const formatCaseDate = (date, options = {}) => {
  const { format = 'year', fallback = '未知年份' } = options;

  if (!date) return fallback;

  try {
    const dateObj = typeof date === 'string' && /^\d{4}$/.test(date)
      ? new Date(parseInt(date), 0, 1)
      : new Date(date);

    if (isNaN(dateObj.getTime())) return fallback;

    switch (format) {
      case 'year':
        return dateObj.getFullYear().toString();
      case 'full':
        return `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
      case 'relative':
        return formatRelativeDate(dateObj);
      default:
        return dateObj.getFullYear().toString();
    }
  } catch {
    return fallback;
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

  if (diffYears > 0) return `${diffYears}年前`;
  if (diffMonths > 0) return `${diffMonths}个月前`;
  if (diffDays > 0) return `${diffDays}天前`;
  return '今天';
};

/**
 * 格式化案例地点
 * @param {string|Object} location - 地点字符串或案例对象
 * @param {Object} [options] - 格式化选项（当第一个参数是字符串时）
 * @param {string} [options.fallback='未知地点'] - 空值时的默认文本
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
    const loc = caseItem.location || '未知地点';
    const year = caseItem.year || '未知年份';
    return `${loc} · ${year}`;
  }

  const { fallback = '未知地点', short = false } = options;

  if (!location) return fallback;

  if (short) {
    // 提取城市名称（去掉省市后缀）
    const cityMatch = location.match(/(.+?)(?:市|省|自治区|特别行政区)/);
    if (cityMatch) {
      return cityMatch[1];
    }
  }

  return location;
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
 * validateCaseForm({ name: '' }) // 返回 { valid: false, errors: ['请输入案例名称'] }
 */
export const validateCaseForm = (form) => {
  const errors = [];

  // 名称验证（必填）
  if (!form?.name?.trim()) {
    errors.push('请输入案例名称');
  }

  // 年份验证（如果提供了年份，验证格式）
  if (form?.year && !/^\d{4}$/.test(form.year.trim())) {
    errors.push('年份格式不正确，请输入4位数字');
  }

  // 名称长度验证
  if (form?.name && form.name.length > 100) {
    errors.push('案例名称不能超过100个字符');
  }

  // 描述长度验证
  if (form?.description && form.description.length > 2000) {
    errors.push('案例描述不能超过2000个字符');
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