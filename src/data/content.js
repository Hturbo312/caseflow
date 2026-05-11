// 个人主页知识图谱内容数据
// 每个节点：id, type, label, position, data, connections

export const nodeTypes = {
  intro: { label: 'About', icon: 'UserCircle' },
  project: { label: 'Projects', icon: 'FolderKanban' },
  skill: { label: 'Skills', icon: 'Zap' },
  blog: { label: 'Writing', icon: 'FileText' },
  dataviz: { label: 'Data', icon: 'BarChart3' },
};

export const nodes = [
  // === 个人介绍 (中心) ===
  {
    id: 'intro',
    type: 'intro',
    label: 'Hturbo',
    position: { x: 0, y: 0 },
    data: {
      title: '数据分析师 & 城市规划师',
      bio: '用数据理解城市，用技术推动规划。关注知识图谱、AI 代理与城市科学的交叉领域。',
      email: 'wjl20010702@163.com',
      github: 'https://github.com/Hturbo312',
    },
    connections: ['caseflow', 'update-old-city', 'skill-data-analysis', 'skill-gis'],
  },

  // === 项目 ===
  {
    id: 'caseflow',
    type: 'project',
    label: 'CaseFlow',
    position: { x: -300, y: -200 },
    data: {
      description: '基于知识图谱的城市案例管理系统，集成 GraphRAG 与 AI 代理，实现智能案例抽取与分析。',
      tags: ['React', 'Tailwind CSS', 'GraphRAG', 'Knowledge Graph'],
      image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&q=80&w=800',
      url: '/caseflow',
    },
    connections: ['skill-react', 'skill-ai'],
  },
  {
    id: 'update-old-city',
    type: 'project',
    label: '更新旧城',
    position: { x: 300, y: -180 },
    data: {
      description: '基于多智能体的城市更新模拟系统，用像素艺术呈现城市演变过程。',
      tags: ['Agent Based Modeling', 'Pixel Art', 'Urban Simulation'],
      image: 'https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&q=80&w=800',
      url: '#',
    },
    connections: ['skill-abm', 'skill-gis'],
  },

  // === 技能 ===
  {
    id: 'skill-react',
    type: 'skill',
    label: 'React',
    position: { x: -400, y: 50 },
    data: {
      proficiency: 0.85,
      description: '前端开发主力框架，用于构建 CaseFlow 等应用。',
    },
    connections: ['skill-typescript'],
  },
  {
    id: 'skill-data-analysis',
    type: 'skill',
    label: '数据分析',
    position: { x: 150, y: 200 },
    data: {
      proficiency: 0.9,
      description: 'Python 数据栈：pandas, numpy, matplotlib，擅长空间数据分析。',
    },
    connections: ['skill-python', 'skill-gis'],
  },
  {
    id: 'skill-gis',
    type: 'skill',
    label: 'GIS',
    position: { x: 350, y: 150 },
    data: {
      proficiency: 0.85,
      description: 'ArcGIS, QGIS, 空间分析与地图可视化。',
    },
    connections: [],
  },
  {
    id: 'skill-python',
    type: 'skill',
    label: 'Python',
    position: { x: 200, y: 350 },
    data: {
      proficiency: 0.88,
      description: '数据处理、机器学习、ABM 模拟。',
    },
    connections: ['skill-ai'],
  },
  {
    id: 'skill-ai',
    type: 'skill',
    label: 'AI / LLM',
    position: { x: -200, y: 300 },
    data: {
      proficiency: 0.75,
      description: 'LLM 应用开发，GraphRAG，智能代理。',
    },
    connections: [],
  },
  {
    id: 'skill-typescript',
    type: 'skill',
    label: 'TypeScript',
    position: { x: -500, y: -50 },
    data: {
      proficiency: 0.8,
      description: '类型安全的前端开发。',
    },
    connections: [],
  },
  {
    id: 'skill-abm',
    type: 'skill',
    label: 'ABM 模拟',
    position: { x: 450, y: 50 },
    data: {
      proficiency: 0.7,
      description: '基于智能体的建模，用于城市演化模拟。',
    },
    connections: [],
  },

  // === 博客 ===
  {
    id: 'blog-kg-urban',
    type: 'blog',
    label: '知识图谱与城市治理',
    position: { x: -150, y: -400 },
    data: {
      excerpt: '探讨如何将知识图谱技术应用于城市治理中的数据孤岛问题...',
      date: '2026-04-15',
      url: '#',
    },
    connections: ['caseflow'],
  },
  {
    id: 'blog-abm-intro',
    type: 'blog',
    label: 'ABM 入门指南',
    position: { x: 150, y: -380 },
    data: {
      excerpt: '从城市规划视角入门 Agent Based Modeling 的实用指南...',
      date: '2026-03-20',
      url: '#',
    },
    connections: ['update-old-city', 'skill-abm'],
  },

  // === 数据可视化 ===
  {
    id: 'dataviz-city',
    type: 'dataviz',
    label: '城市热力图',
    position: { x: 450, y: 300 },
    data: {
      description: '基于 POI 数据的城市功能密度热力图，展示城市空间结构。',
      chartType: 'heatmap',
    },
    connections: ['skill-gis', 'skill-data-analysis'],
  },
  {
    id: 'dataviz-network',
    type: 'dataviz',
    label: '知识图谱可视化',
    position: { x: -450, y: 200 },
    data: {
      description: 'CaseFlow 中知识图谱的可视化探索：实体关系、路径分析。',
      chartType: 'network',
    },
    connections: ['caseflow', 'skill-react'],
  },
];
