import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '@store/canvasStore';

/**
 * 可缩放/拖拽的视口容器
 * 纯事件监听，不与 Framer Motion 冲突
 */
function CanvasViewport({ children }) {
  const { viewport, setViewport } = useCanvasStore();
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // 初始化居中
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setViewport({ x: w / 2, y: h / 2, zoom: 1 });
      setInitialized(true);
    }
  }, [initialized, setViewport]);

  // 滚轮缩放
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(2.5, Math.max(0.3, viewport.zoom + delta));
    setViewport({ zoom: newZoom });
  }, [viewport.zoom, setViewport]);

  // 鼠标拖拽平移
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.graph-node')) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    containerRef.current.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setViewport({ x: viewport.x + dx, y: viewport.y + dy });
  }, [viewport.x, viewport.y, setViewport]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: 'grab',
      }}
    >
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default CanvasViewport;
