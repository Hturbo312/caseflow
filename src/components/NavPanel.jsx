import { useCanvasStore } from '@store/canvasStore';
import { nodes as allNodes, nodeTypes } from '@/data/content';

const categories = [
  { type: 'intro', label: 'About' },
  { type: 'project', label: 'Projects' },
  { type: 'skill', label: 'Skills' },
  { type: 'blog', label: 'Writing' },
  { type: 'dataviz', label: 'Data' },
];

/**
 * 侧边导航 — 按类别跳转
 */
function NavPanel() {
  const { setViewport, setActiveNode, nodePositions } = useCanvasStore();

  const goTo = (type) => {
    const node = allNodes.find((n) => n.type === type);
    if (!node) return;
    const pos = nodePositions[node.id] || node.position;
    const w = window.innerWidth;
    const h = window.innerHeight;
    setViewport({
      x: w / 2 - pos.x,
      y: h / 2 - pos.y,
      zoom: 1.2,
    });
    setActiveNode(node.id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
      }}
    >
      {categories.map((cat) => (
        <button
          key={cat.type}
          onClick={() => goTo(cat.type)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: 0,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              border: '1.5px solid #111',
              background: '#fff',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#111')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          />
          <span
            style={{
              fontSize: 9,
              color: '#999',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export default NavPanel;
