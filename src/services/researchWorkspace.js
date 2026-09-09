import { authHelper } from '../utils/authHelper';
import { API_BASE_URL } from '../utils/constants';

export async function researchRequest(caseId, path = '', body) {
  const response = await fetch(`${API_BASE_URL}/research-workspace/${caseId}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${authHelper.getToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(`服务器返回 ${response.status}，请重试；较大的材料可拆分上传。`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}
export async function sourceBlob(caseId, sourceId) {
  const response = await fetch(`${API_BASE_URL}/research-workspace/${caseId}/materials/${sourceId}?raw=1`, { headers: { Authorization: `Bearer ${authHelper.getToken()}` } });
  if (!response.ok) throw new Error('原文件读取失败，请重试');
  return response.blob();
}
export async function uploadResearchFiles(caseId, files) {
  const results = [];
  for (const file of files) {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('每份材料最多 20 MB');
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await researchRequest(caseId, '/materials', { name: file.name, base64 });
      results.push({ name: file.name, ok: true, ...result });
    } catch (e) { results.push({ name: file.name, ok: false, error: e.message }); }
  }
  window.dispatchEvent(new CustomEvent('cf:research-updated', { detail: { caseId } }));
  return results;
}
