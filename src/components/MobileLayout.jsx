import { motion } from 'framer-motion';
import { Github, Mail, ExternalLink, TrendingUp, UserCircle, FolderKanban, Zap, FileText, BarChart3 } from 'lucide-react';
import { nodes as allNodes, nodeTypes } from '@/data/content';

const iconMap = {
  intro: UserCircle,
  project: FolderKanban,
  skill: Zap,
  blog: FileText,
  dataviz: BarChart3,
};

/**
 * 移动端纵向布局 — 白底黑线风格
 */
function MobileLayout() {
  const intro = allNodes.find((n) => n.type === 'intro');
  const projects = allNodes.filter((n) => n.type === 'project');
  const skills = allNodes.filter((n) => n.type === 'skill');
  const blogs = allNodes.filter((n) => n.type === 'blog');
  const dataviz = allNodes.filter((n) => n.type === 'dataviz');

  return (
    <div style={{ background: '#fff', minHeight: '100vh', color: '#111' }}>
      {/* Hero */}
      <section style={{ padding: '60px 24px 40px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
        <UserCircle size={64} strokeWidth={1} color="#111" style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>
          {intro?.label || 'Hturbo'}
        </h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>{intro?.data?.title}</p>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, maxWidth: 360, margin: '0 auto 20px' }}>
          {intro?.data?.bio}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a href={`mailto:${intro?.data?.email}`} style={mobileLinkStyle}>
            <Mail size={14} /> Email
          </a>
          <a href={intro?.data?.github} target="_blank" rel="noopener noreferrer" style={mobileLinkStyle}>
            <Github size={14} /> GitHub
          </a>
        </div>
      </section>

      {/* Projects */}
      <section style={{ padding: '40px 24px', borderBottom: '1px solid #eee' }}>
        <h2 style={sectionTitleStyle}>Projects</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} node={p} />
          ))}
        </div>
      </section>

      {/* Skills */}
      <section style={{ padding: '40px 24px', borderBottom: '1px solid #eee' }}>
        <h2 style={sectionTitleStyle}>Skills</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {skills.map((s) => (
            <SkillBar key={s.id} node={s} />
          ))}
        </div>
      </section>

      {/* Blog */}
      <section style={{ padding: '40px 24px', borderBottom: '1px solid #eee' }}>
        <h2 style={sectionTitleStyle}>Writing</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {blogs.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={mobileCardStyle}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{b.label}</h3>
              <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 8 }}>{b.data.excerpt}</p>
              <span style={{ fontSize: 11, color: '#999' }}>{b.data.date}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Data Viz */}
      <section style={{ padding: '40px 24px' }}>
        <h2 style={sectionTitleStyle}>Data</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dataviz.map((d) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={mobileCardStyle}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{d.label}</h3>
              <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{d.data.description}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectCard({ node }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      style={mobileCardStyle}
    >
      {node.data.image && (
        <div
          style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 8,
            marginBottom: 14,
            backgroundImage: `url(${node.data.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid #eee',
          }}
        />
      )}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{node.label}</h3>
      <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 10 }}>{node.data.description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {node.data.tags.map((t) => (
          <span key={t} style={tagStyle}>{t}</span>
        ))}
      </div>
    </motion.div>
  );
}

function SkillBar({ node }) {
  const proficiency = node.data.proficiency || 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{node.label}</span>
        <span style={{ fontSize: 12, color: '#888' }}>{Math.round(proficiency * 100)}%</span>
      </div>
      <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${proficiency * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', background: '#111', borderRadius: 3 }}
        />
      </div>
    </motion.div>
  );
}

const sectionTitleStyle = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  marginBottom: 20,
  color: '#111',
};

const mobileCardStyle = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 10,
  padding: 20,
};

const mobileLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: '#111',
  textDecoration: 'none',
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #ddd',
};

const tagStyle = {
  fontSize: 11,
  padding: '4px 10px',
  background: '#f5f5f5',
  borderRadius: 4,
  color: '#555',
  border: '1px solid #e0e0e0',
};

export default MobileLayout;
