/**
 * Schema 过滤工具函数
 * 统一处理 SchemaId 的匹配和过滤逻辑
 */

import { normalizeId, idsMatch } from '@utils/idGenerator';

// ==================== SchemaId 标准化 ====================

/**
 * 标准化 SchemaId 为字符串类型
 * 委托给共享的 normalizeId 工具函数
 * @param {string|number|Object} id - 原始 SchemaId
 * @returns {string|null} 标准化后的 SchemaId 字符串，无效时返回 null
 */
export const normalizeSchemaId = normalizeId;

/**
 * 检查两个 SchemaId 是否匹配
 * 委托给共享的 idsMatch 工具函数
 * @param {string|number} schemaId1 - 第一个 SchemaId
 * @param {string|number} schemaId2 - 第二个 SchemaId
 * @returns {boolean} 是否匹配
 */
export const matchesSchemaId = idsMatch;

/**
 * 从案例对象中提取 SchemaId
 * 支持多种字段名称（schemaId, schema_id）以兼容不同数据源
 * @param {Object} caseItem - 案例对象
 * @returns {string|null} 提取的 SchemaId
 * @example
 * extractSchemaId({ schemaId: '123' }) // 返回 '123'
 * extractSchemaId({ schema_id: 456 }) // 返回 '456'
 */
export const extractSchemaId = (caseItem) => {
  if (!caseItem) return null;

  const rawId = caseItem.schemaId ?? caseItem.schema_id;
  return normalizeSchemaId(rawId);
};

// ==================== 过滤和查找 ====================

/**
 * 检查案例是否属于指定 Schema
 * @param {Object} caseItem - 案例数据
 * @param {string|number} schemaId - Schema ID
 * @returns {boolean} 是否属于该 Schema
 */
export const caseBelongsToSchema = (caseItem, schemaId) => {
  const caseSchemaId = extractSchemaId(caseItem);
  return matchesSchemaId(caseSchemaId, schemaId);
};

/**
 * 根据当前 SchemaId 过滤案例列表
 * @param {Array<Object>} cases - 案例列表
 * @param {string|number} currentSchemaId - 当前选中的 SchemaId
 * @returns {Array<Object>} 过滤后的案例列表
 */
export const filterCasesBySchema = (cases, currentSchemaId) => {
  if (!Array.isArray(cases)) return [];
  if (!currentSchemaId) return cases;

  return cases.filter(caseItem => caseBelongsToSchema(caseItem, currentSchemaId));
};

/**
 * 从 Schema 列表中查找匹配的 Schema
 * @param {Array<Object>} schemas - Schema 列表
 * @param {string|number} schemaId - 要查找的 SchemaId
 * @returns {Object|undefined} 找到的 Schema 对象，未找到返回 undefined
 */
export const findSchemaById = (schemas, schemaId) => {
  if (!Array.isArray(schemas)) return undefined;

  return schemas.find(schema => matchesSchemaId(schema.id, schemaId));
};

/**
 * 获取 Schema 的显示名称
 * 如果未找到 Schema 或 ID 无效，返回默认文本
 * @param {Array<Object>} schemas - Schema 列表
 * @param {string|number} schemaId - SchemaId
 * @param {string} [fallback='未关联 Schema'] - 未找到时的默认文本
 * @returns {string} Schema 名称或默认文本
 */
export const getSchemaName = (schemas, schemaId, fallback = '未关联 Schema') => {
  const schema = findSchemaById(schemas, schemaId);
  return schema?.name || fallback;
};

/**
 * 获取案例关联的 Schema 名称
 * @param {Object} caseItem - 案例对象
 * @param {Array<Object>} schemas - Schema 列表
 * @param {string} [fallback='未关联 Schema'] - 未找到时的默认文本
 * @returns {string} Schema 名称或默认文本
 */
export const getCaseSchemaName = (caseItem, schemas, fallback = '未关联 Schema') => {
  const schemaId = extractSchemaId(caseItem);
  return getSchemaName(schemas, schemaId, fallback);
};