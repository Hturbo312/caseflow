import { useRef, useEffect, useCallback } from 'react';

/**
 * 粒子聚合头像 — 粒子从随机位置聚合成目标形状，鼠标靠近时散开
 * 不依赖外部图片，用 Canvas 从传入的 DOM 元素（头像容器）采样颜色生成粒子目标位置
 */
function ParticleAvatar({ width = 120, height = 120, className = '' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(null);

  const PARTICLE_COUNT = 1200;
  const PARTICLE_RADIUS = 1.0;
  const MOUSE_RADIUS = 50;
  const AGGREGATE_SPEED = 0.08;
  const SCATTER_FORCE = 6;
  const PAD = 30;

  // 从 Canvas 上绘制一个渐变圆，然后采样得到粒子目标位置
  const generateTargetPositions = useCallback((ctx, w, h) => {
    // 绘制目标图形（和原来一样的渐变圆）
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#5856d6');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.fill();

    // 采样像素
    const imageData = ctx.getImageData(0, 0, w, h);
    const targets = [];
    const gap = 2; // 采样间隔，越小粒子越密

    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        const i = (y * w + x) * 4;
        const alpha = imageData.data[i + 3];
        if (alpha > 128) {
          targets.push({
            x,
            y,
            r: imageData.data[i],
            g: imageData.data[i + 1],
            b: imageData.data[i + 2],
          });
        }
      }
    }
    return targets;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // 实际 Canvas 尺寸略大一些，给粒子散射留出空间
    const pad = PAD;
    canvas.width = (width + pad * 2) * dpr;
    canvas.height = (height + pad * 2) * dpr;
    canvas.style.width = `${width + pad * 2}px`;
    canvas.style.height = `${height + pad * 2}px`;
    ctx.scale(dpr, dpr);

    const canvasW = width + pad * 2;
    const canvasH = height + pad * 2;

    // 采样目标位置
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    const sampled = generateTargetPositions(offCtx, width, height);

    // 如果采样不足，用默认圆形填充
    const targets = sampled.length > 50 ? sampled : [];

    // 初始化粒子
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const target = targets[i % targets.length] || {
        x: width / 2 + Math.cos(i * 0.1) * (width / 2 - 10),
        y: height / 2 + Math.sin(i * 0.1) * (height / 2 - 10),
        r: 59, g: 130, b: 246,
      };
      particles.push({
        x: pad + Math.random() * width,
        y: pad + Math.random() * height,
        originX: target.x + pad,
        originY: target.y + pad,
        targetX: target.x + pad,
        targetY: target.y + pad,
        r: target.r || 59,
        g: target.g || 130,
        b: target.b || 246,
        vx: 0,
        vy: 0,
        radius: PARTICLE_RADIUS + Math.random() * 0.5,
      });
    }
    particlesRef.current = particles;

    const rect = canvas.getBoundingClientRect();
    const handleMouseMove = (e) => {
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

    // 动画循环
    const animate = () => {
      ctx.clearRect(0, 0, canvasW, canvasH);
      const mouse = mouseRef.current;

      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS) {
          // 鼠标靠近：散射
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force * SCATTER_FORCE;
          p.vy += Math.sin(angle) * force * SCATTER_FORCE;
        }

        // 聚合回目标位置
        const homeX = p.targetX - p.x;
        const homeY = p.targetY - p.y;
        p.vx += homeX * AGGREGATE_SPEED;
        p.vy += homeY * AGGREGATE_SPEED;

        // 阻尼
        p.vx *= 0.92;
        p.vy *= 0.92;

        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [width, height, generateTargetPositions]);

  return (
    <div
      ref={containerRef}
      className={`particle-avatar ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: `${width + PAD * 2}px`,
        height: `${height + PAD * 2}px`,
        borderRadius: '50%',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}

export default ParticleAvatar;
