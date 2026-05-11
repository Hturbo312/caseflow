import { useRef, useEffect, useCallback } from 'react';

/**
 * 城市网格背景 — 极简城市街区线稿，鼠标经过时街区微亮
 * 作为首页右侧项目区的背景层，不影响内容可读性
 */
function CityGridBackground({ className = '' }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const blocksRef = useRef([]);
  const animRef = useRef(null);

  const BLOCK_GLOW_RADIUS = 120;
  const GLOW_INTENSITY = 0.15;

  // 生成城市街区
  const generateCity = useCallback((w, h) => {
    const blocks = [];
    const cols = 12;
    const rows = 8;
    const cellW = w / cols;
    const cellH = h / rows;
    const margin = 8;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // 随机跳过一些格子制造不规则感
        if (Math.random() < 0.15) continue;

        const x = col * cellW + margin + Math.random() * 4;
        const y = row * cellH + margin + Math.random() * 4;
        const bw = cellW - margin * 2 - Math.random() * 6;
        const bh = cellH - margin * 2 - Math.random() * 6;

        blocks.push({
          x, y, w: bw, h: bh,
          // 建筑高度（用透明度模拟深度）
          height: 0.3 + Math.random() * 0.7,
          // 当前亮度
          glow: 0,
        });
      }
    }
    return blocks;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      blocksRef.current = generateCity(rect.width, rect.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const mouse = mouseRef.current;

      for (const block of blocksRef.current) {
        // 计算与鼠标的距离
        const cx = block.x + block.w / 2;
        const cy = block.y + block.h / 2;
        const dx = cx - mouse.x;
        const dy = cy - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 目标亮度
        const targetGlow = dist < BLOCK_GLOW_RADIUS
          ? (1 - dist / BLOCK_GLOW_RADIUS) * GLOW_INTENSITY * block.height
          : 0;

        // 平滑过渡
        block.glow += (targetGlow - block.glow) * 0.08;

        // 绘制街区
        const baseAlpha = 0.04 + block.glow;
        ctx.fillStyle = `rgba(6, 182, 212, ${baseAlpha})`; // cyan
        ctx.fillRect(block.x, block.y, block.w, block.h);

        // 边框
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.06 + block.glow * 1.5})`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(block.x, block.y, block.w, block.h);
      }

      // 绘制道路（格子间的空隙用更淡的线）
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;

      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [generateCity]);

  return (
    <canvas
      ref={canvasRef}
      className={`city-grid-bg ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

export default CityGridBackground;
