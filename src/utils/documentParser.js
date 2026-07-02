/**
 * 纯前端文档解析（PDF / DOCX / TXT → 纯文本）
 * PDF 使用 pdfjs-dist（Mozilla 官方），DOCX 使用 mammoth
 */

// Promise.withResolvers polyfill（pdfjs-dist v5 依赖此 ES2024 API）
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Vite 会将 worker 文件打包到 assets 目录并返回其 URL
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// 配置 worker 路径
GlobalWorkerOptions.workerSrc = PdfjsWorker;

export async function parsePDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    fullText += text + '\n\n';
  }
  return fullText.trim();
}

export async function parseDOCX(file) {
  const mammoth = await import('mammoth');
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}

export function extractFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

export async function parseDocument(file) {
  const ext = extractFileExtension(file.name);

  switch (ext) {
    case 'pdf':
      return parsePDF(file);
    case 'docx':
      return parseDOCX(file);
    case 'txt':
      return file.text();
    default:
      throw new Error(`不支持的文件格式：.${ext}，支持 PDF / DOCX / TXT`);
  }
}
