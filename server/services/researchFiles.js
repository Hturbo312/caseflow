import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { digest } from './researchModel.js';

const exec = promisify(execFile);
export const MATERIAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../case-workspace');
export function materialPath(relative) {
  const absolute = path.resolve(MATERIAL_ROOT, relative);
  if (!absolute.startsWith(MATERIAL_ROOT + path.sep)) throw new Error('材料路径无效');
  return absolute;
}
export async function archiveMaterial(caseId, schemaId, userId, payload) {
  const name = path.basename(String(payload.name || payload.title || '粘贴材料.md')).replace(/[\x00-\x1f]/g, '').slice(0, 200);
  const buffer = payload.base64 ? Buffer.from(payload.base64, 'base64') : Buffer.from(String(payload.text || ''), 'utf8');
  if (!name || !buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error('材料不能为空，每份最多 20 MB');
  const id = randomUUID();
  const directory = `${Number(schemaId) || 0}-${Number(caseId)}-material/${id}`;
  const relative = `${directory}/original/${name}`;
  await mkdir(materialPath(`${directory}/original`), { recursive: true });
  await writeFile(materialPath(relative), buffer, { flag: 'wx' });
  const source = { id, title: name, filePath: relative, hash: digest(buffer), size: buffer.length, ownerId: userId, extension: path.extname(name).toLowerCase(), uri: String(payload.uri || '').slice(0, 2000), createdAt: new Date().toISOString(), status: 'pending', text: '', blocks: [] };
  await writeFile(materialPath(`${directory}/metadata.json`), JSON.stringify(source, null, 2));
  return source;
}
export async function parseMaterial(source) {
  if (!source.filePath) return { ...source, status: 'ready' };
  const buffer = await readFile(materialPath(source.filePath));
  let chunks = [], html = '';
  if (source.extension === '.pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false }).promise;
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const items = content.items.filter(i => typeof i.str === 'string');
        chunks.push({ id: `page-${pageNumber}`, page: pageNumber, text: items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('').trim() });
        page.cleanup();
      }
    } finally { await pdf.destroy(); }
  } else if (source.extension === '.docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    html = (await mammoth.convertToHtml({ buffer })).value;
    chunks = result.value.split(/\n\s*\n/).filter(t => t.trim()).map((text, i) => ({ id: `paragraph-${i + 1}`, text: text.trim() }));
  } else if (source.extension === '.doc') {
    try {
      const { stdout } = await exec('antiword', ['-m', 'UTF-8.txt', materialPath(source.filePath)], { maxBuffer: 20 * 1024 * 1024, timeout: 60000 });
      chunks = stdout.split(/\n\s*\n/).filter(t => t.trim()).map((text, i) => ({ id: `paragraph-${i + 1}`, text: text.trim() }));
    } catch { return { ...source, status: 'unsupported', error: '原始 DOC 已归档，暂不能解析；请另存为 DOCX 后上传。' }; }
  } else if (['.txt', '.md', '.markdown', '.csv'].includes(source.extension)) {
    chunks = buffer.toString('utf8').split(/\n\s*\n/).filter(t => t.trim()).map((text, i) => ({ id: `paragraph-${i + 1}`, text: text.trim() }));
  } else return { ...source, status: 'unsupported', error: '原始附件已归档；此格式暂未接入文字识别或转写。' };
  let start = 0;
  const blocks = chunks.map(b => { const block = { ...b, start }; start += b.text.length + 2; return block; });
  const text = blocks.map(b => b.text).join('\n\n');
  if (!text.trim()) return { ...source, status: 'unsupported', error: '未识别到可用文字。扫描 PDF 需要 OCR，请补充可选中文字的文件或粘贴转录文本。' };
  const parsed = { ...source, text, blocks, ...(html ? { html } : {}), status: 'ready', error: null };
  await writeFile(materialPath(path.dirname(path.dirname(source.filePath)) + '/parsed.json'), JSON.stringify({ text, blocks, html }));
  return parsed;
}
