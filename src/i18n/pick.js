/**
 * 按语言挑选成对字段（content.js 等数据文件的 { zh, en } 结构）
 * 兼容纯字符串：未成对化的字段原样返回
 */
export function pick(value, locale) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if ('zh' in value || 'en' in value) {
      return value[locale] || value.zh || value.en || '';
    }
  }
  return value || '';
}
