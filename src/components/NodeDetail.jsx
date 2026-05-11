import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Github, Mail, ExternalLink, TrendingUp } from 'lucide-react';
import { useCanvasStore } from '@store/canvasStore';
import { nodes as allNodes } from '@/data/content';

/**
 * 节点详情弹窗
 */
function NodeDetail() {
  const { activeNode, setActiveNode, nodePositions } = useCanvasStore();

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setActiveNode(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setActiveNode]);

  if (!activeNode) return null;
  const node = allNodes.find((n) => n.id === activeNode);
  if (!node) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => setActiveNode(null)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            background: '#fff',
            border: '1.5px solid #111',
            borderRadius: 10,
            padding: 32,
            maxWidth: 520,
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            position: 'relative',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => setActiveNode(null)}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: 6,
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color="#666" />
          </button>

          {/* Header */}
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4, letterSpacing: '-0.02em' }}>
            {node.label}
          </h2>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {node.type}
          </p>

          {/* Content by type */}
          {node.type === 'intro' && <IntroContent data={node.data} />}
          {node.type === 'project' && <ProjectContent data={node.data} />}
          {node.type === 'skill' && <SkillContent data={node.data} />}
          {node.type === 'blog' && <BlogContent data={node.data} />}
          {node.type === 'dataviz' && <DatavizContent data={node.data} />}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function IntroContent({ data }) {
  return (
    <div>
      <p style={{ fontSize: 15, color: '#444', lineHeight: 1.7, marginBottom: 24 }}>{data.bio}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <a href={`mailto:${data.email}`} style={linkStyle}>
          <Mail size={14} />
          <span>{data.email}</span>
        </a>
        <a href={data.github} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          <Github size={14} />
          <span>GitHub</span>
        </a>
      </div>
    </div>
  );
}

function ProjectContent({ data }) {
  return (
    <div>
      {data.image && (
        <div
          style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 8,
            marginBottom: 20,
            backgroundImage: `url(${data.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid #eee',
          }}
        />
      )}
      <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginBottom: 16 }}>{data.description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {data.tags.map((tag) => (
          <span key={tag} style={tagStyle}>{tag}</span>
        ))}
      </div>
      {data.url && data.url !== '#' && (
        <a href={data.url} style={{ ...linkStyle, display: 'inline-flex' }}>
          <ExternalLink size={14} />
          <span>View Project</span>
        </a>
      )}
    </div>
  );
}

function SkillContent({ data }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginBottom: 16 }}>{data.description}</p>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#888', minWidth: 30 }}>Proficiency</span>
        <div style={{ flex: 1, height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              width: `${(data.proficiency || 0) * 100}%`,
              height: '100%',
              background: '#111',
              borderRadius: 3,
            }}
          />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
          {Math.round((data.proficiency || 0) * 100)}%
        </span>
      </div>
    </div>
  );
}

function BlogContent({ data }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginBottom: 12 }}>{data.excerpt}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#888' }}>{data.date}</span>
      </div>
      {data.url && data.url !== '#' && (
        <a href={data.url} style={{ ...linkStyle, display: 'inline-flex' }}>
          <ExternalLink size={14} />
          <span>Read More</span>
        </a>
      )}
    </div>
  );
}

function DatavizContent({ data }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginBottom: 16 }}>{data.description}</p>
      <div
        style={{
          width: '100%',
          height: 200,
          background: '#f9f9f9',
          border: '1px dashed #ccc',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 13,
          gap: 8,
        }}
      >
        <TrendingUp size={16} />
        <span>Visualization placeholder</span>
      </div>
    </div>
  );
}

const linkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: '#111',
  textDecoration: 'none',
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid #ddd',
  transition: 'all 0.2s',
};

const tagStyle = {
  fontSize: 11,
  padding: '4px 10px',
  background: '#f5f5f5',
  borderRadius: 4,
  color: '#555',
  border: '1px solid #e0e0e0',
};

export default NodeDetail;
