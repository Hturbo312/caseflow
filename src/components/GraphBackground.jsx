import { useRef, useEffect } from 'react';

/**
 * 白底黑线手绘风格背景
 * 不规则黑色线条网格 + 随机点缀
 */
function GraphBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, w, h);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        background: '#fff',
      }}
    />
  );
}

function draw(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  // 手绘风格不规则网格
  const cols = 14;
  const rows = 10;
  const cellW = w / cols;
  const cellH = h / rows;

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;

  // 水平线（带随机弯曲）
  for (let row = 0; row <= rows; row++) {
    ctx.beginPath();
    for (let col = 0; col <= cols; col++) {
      const x = col * cellW + (Math.random() - 0.5) * 20;
      const y = row * cellH + (Math.random() - 0.5) * 10;
      if (col === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 垂直线（带随机弯曲）
  for (let col = 0; col <= cols; col++) {
    ctx.beginPath();
    for (let row = 0; row <= rows; row++) {
      const x = col * cellW + (Math.random() - 0.5) * 10;
      const y = row * cellH + (Math.random() - 0.5) * 20;
      if (row === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 随机小黑点装饰
  ctx.fillStyle = '#ccc';
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 随机短划线装饰
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const angle = Math.random() * Math.PI;
    const len = 5 + Math.random() * 15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
}

export default GraphBackground;
