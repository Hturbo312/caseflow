// 分析图表导出工具：PNG（SVG 序列化→canvas）、CSV、JSON
// 图表必须可复现（Spec §2.5）：导出携带 Schema 版本与查询条件

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON(data, filename) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${filename}.json`);
}

export function exportCSV(rows, filename) {
  // rows: 二维数组（首行表头）
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

// 将 <svg> 元素导出为 PNG（2x 缩放）
export function exportSVGAsPNG(svgEl, filename, { scale = 2, background = '#ffffff' } = {}) {
  if (!svgEl) return;
  const w = svgEl.viewBox?.baseVal?.width || svgEl.clientWidth || 900;
  const h = svgEl.viewBox?.baseVal?.height || svgEl.clientHeight || 500;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `${filename}.png`), 'image/png');
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}
