/**
 * AI prompt templates for case extraction and analysis
 */

/**
 * Generate case extraction prompt for AI
 * @param {Object} schema - Schema object with entityTypes and relations
 * @param {string} caseText - Case description text
 * @returns {string} Formatted prompt string
 */
export const caseExtractionPrompt = (schema, caseText) => {
  const entityTypes = schema?.entityTypes || [];
  const relations = schema?.relations || [];

  return `你是一个专业的城市更新案例拆解专家。请根据以下 Schema 结构从案例文本中提取实体和关系。

## Schema 结构定义

### 实体类型：
${entityTypes.map(e => {
  const props = e.properties?.map(p => `${p.name}(${p.type})`).join(', ') || '无';
  return `- ${e.name}: 属性 [${props}]`;
}).join('\n')}

### 关系类型：
${relations.map(r => `- ${r.name}: ${r.from} -> ${r.to}`).join('\n') || '无预定义关系'}

## 案例文本
${caseText}

## 输出要求
请严格按照以下 JSON 格式输出：
{
  "entities": [
    {
      "name": "实体名称",
      "entityType": "实体类型（必须匹配上述定义）",
      "properties": {
        "属性名": "属性值"
      }
    }
  ],
  "relations": [
    {
      "name": "关系名称",
      "sourceName": "源实体名称",
      "targetName": "目标实体名称"
    }
  ],
  "summary": "案例拆解总结（简短描述提取的关键信息）"
}

注意：
1. 实体类型必须严格匹配 Schema 中定义的类型
2. 关系必须在 Schema 中有对应的定义
3. 如果文本中没有提到某个实体类型的相关信息，可以不提取
4. 属性值应尽量从文本中提取原始信息，避免推断`;
};

/**
 * Generate simple extraction prompt (for quick UI display)
 * @param {Array} entityTypes - Schema entity types
 * @param {Array} relations - Schema relations
 * @param {string} caseText - Case description text
 * @returns {string} Formatted simple prompt
 */
export const simpleExtractionPrompt = (entityTypes, relations, caseText) => {
  return `
你是一个专业的城市更新案例拆解助手。请根据以下 Schema 结构，从案例文本中提取实体和关系。

## Schema 结构
实体类型：
${entityTypes.map(e => `- ${e.name} (属性: ${e.properties?.map(p => p.name).join(', ') || '无'})`).join('\n')}

关系类型：
${relations?.map(r => `- ${r.name}: ${r.from} -> ${r.to}`).join('\n') || '无预定义关系'}

## 案例文本
${caseText}

## 输出要求
请以 JSON 格式输出提取结果，格式如下：
{
  "entities": [
    { "name": "实体名称", "entityType": "实体类型", "properties": {} }
  ],
  "relations": [
    { "name": "关系名称", "sourceName": "源实体名称", "targetName": "目标实体名称" }
  ]
}

请只输出 JSON，不要有其他内容。
`;
};

/**
 * Generate RAG query prompt
 * @param {string} question - User question
 * @param {string} context - Retrieved context
 * @returns {string} Formatted RAG prompt
 */
export const ragQueryPrompt = (question, context) => {
  return `基于以下知识图谱信息回答问题。

## 相关知识图谱数据
${context}

## 问题
${question}

## 回答要求
1. 结合知识图谱数据回答问题
2. 如果知识图谱中没有相关信息，请明确说明
3. 回答要准确、简洁、有条理`;
};