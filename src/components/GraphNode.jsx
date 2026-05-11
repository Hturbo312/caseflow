import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UserCircle, FolderKanban, Zap, FileText, BarChart3 } from 'lucide-react';
import { useCanvasStore } from '@store/canvasStore';

const iconMap = {
  intro: UserCircle,
  project: FolderKanban,
  skill: Zap,
  blog: FileText,
  dataviz: BarChart3,
};

const typeLabelMap = {
  intro: 'About',
  project: 'Project',
  skill: 'Skill',
  blog: 'Writing',
  dataviz: 'Data',
};

/**
 * 单个节点卡片 — 白底黑线风格
 * 使用 Framer Motion drag + 内联 transform，不与 animate 冲突
 */
function GraphNode({ node }) {
  const { setActiveNode, nodePositions, setNodePosition } = useCanvasStore();
  const [isHovered, setIsHovered] = useState(false);

  const pos = nodePositions[node.id] || node.position;
  const Icon = iconMap[node.type] || UserCircle;

  const width = node.type === 'intro' ? 200 : 160;
  const height = node.type === 'intro' ? 100 : 80;

  return (
    <motion.div
      className="graph-node"
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={(_e, info) => {
        setNodePosition(node.id, {
          x: (nodePositions[node.id]?.x || pos.x) + info.offset.x,
          y: (nodePositions[node.id]?.y || pos.y) + info.offset.y,
        });
      }}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        cursor: 'pointer',
        zIndex: isHovered ? 10 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setActiveNode(node.id);
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fff',
          border: `1.5px solid ${isHovered ? '#000' : '#333'}`,
          borderRadius: 6,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} strokeWidth={1.5} color="#111" />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#111',
              letterSpacing: '-0.01em',
            }}
          >
            {node.label}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#888', letterSpacing: '0.02em' }}>
          {typeLabelMap[node.type]}
        </span>
      </div>
    </motion.div>
  );
}

export default GraphNode;
