// 系统层词条（api.js 错误文案 / NodeDetail 等）
export const pairs = {
  'api.error.nonJson': ['服务器返回非 JSON 响应（HTTP {status}）：{preview}', 'Server returned a non-JSON response (HTTP {status}): {preview}'],
  'api.error.unknown': ['未知错误', 'Unknown error'],
  'api.error.badResponse': ['API 响应格式异常，请检查后端服务是否正常运行', 'Malformed API response — please check whether the backend service is running'],
  'api.error.emptyBody': ['响应体为空', 'Response body is empty'],
  'api.error.sseFailed': ['SSE 流式调用异常', 'SSE streaming error'],
  'node.detail.proficiency': ['熟练度', 'Proficiency'],
  'node.detail.readMore': ['阅读全文', 'Read More'],
  'node.detail.vizPlaceholder': ['可视化占位', 'Visualization placeholder'],
};
