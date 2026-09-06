// 个人主页知识图谱内容数据
// 每个节点：id, type, label, position, data, connections
// 用户可见文案字段（label / title / bio / description / excerpt）均为 { zh, en } 成对结构；
// 品牌名节点（Hturbo、CaseFlow、React 等）双语值相同；tags、链接、图片、日期等保持原样

export const nodeTypes = {
  intro: { label: { zh: '关于', en: 'About' }, icon: 'UserCircle' },
  project: { label: { zh: '项目', en: 'Projects' }, icon: 'FolderKanban' },
  skill: { label: { zh: '技能', en: 'Skills' }, icon: 'Zap' },
  blog: { label: { zh: '写作', en: 'Writing' }, icon: 'FileText' },
  dataviz: { label: { zh: '数据', en: 'Data' }, icon: 'BarChart3' },
};

export const nodes = [
  // === 个人介绍 (中心) ===
  {
    id: 'intro',
    type: 'intro',
    label: { zh: 'Hturbo', en: 'Hturbo' },
    position: { x: 0, y: 0 },
    data: {
      title: { zh: '数据分析师 & 城市规划师', en: 'Data Analyst & Urban Planner' },
      bio: {
        zh: '用数据理解城市，用技术推动规划。关注知识图谱、AI 代理与城市科学的交叉领域。',
        en: 'Understanding cities through data, advancing planning through technology. Focused on the intersection of knowledge graphs, AI agents, and urban science.',
      },
      email: 'wjl20010702@163.com',
      github: 'https://github.com/Hturbo312',
    },
    connections: ['caseflow', 'update-old-city', 'skill-data-analysis', 'skill-gis'],
  },

  // === 项目 ===
  {
    id: 'caseflow',
    type: 'project',
    label: { zh: 'CaseFlow', en: 'CaseFlow' },
    position: { x: -300, y: -200 },
    data: {
      description: {
        zh: '基于知识图谱的城市案例管理系统，集成 GraphRAG 与 AI 代理，实现智能案例抽取与分析。',
        en: 'A knowledge-graph-based urban case management system that integrates GraphRAG and AI agents for intelligent case extraction and analysis.',
      },
      tags: ['React', 'Tailwind CSS', 'GraphRAG', 'Knowledge Graph'],
      image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&q=80&w=800',
      url: '/caseflow',
    },
    connections: ['skill-react', 'skill-ai'],
  },
  {
    id: 'update-old-city',
    type: 'project',
    label: { zh: '更新旧城', en: 'Old City Renewal' },
    position: { x: 300, y: -180 },
    data: {
      description: {
        zh: '基于多智能体的城市更新模拟系统，用像素艺术呈现城市演变过程。',
        en: 'A multi-agent urban regeneration simulation that presents urban evolution through pixel art.',
      },
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
    label: { zh: 'React', en: 'React' },
    position: { x: -400, y: 50 },
    data: {
      proficiency: 0.85,
      description: {
        zh: '前端开发主力框架，用于构建 CaseFlow 等应用。',
        en: 'My primary frontend framework, used to build CaseFlow and other apps.',
      },
    },
    connections: ['skill-typescript'],
  },
  {
    id: 'skill-data-analysis',
    type: 'skill',
    label: { zh: '数据分析', en: 'Data Analysis' },
    position: { x: 150, y: 200 },
    data: {
      proficiency: 0.9,
      description: {
        zh: 'Python 数据栈：pandas, numpy, matplotlib，擅长空间数据分析。',
        en: 'Python data stack: pandas, numpy, matplotlib, with a focus on spatial data analysis.',
      },
    },
    connections: ['skill-python', 'skill-gis'],
  },
  {
    id: 'skill-gis',
    type: 'skill',
    label: { zh: 'GIS', en: 'GIS' },
    position: { x: 350, y: 150 },
    data: {
      proficiency: 0.85,
      description: {
        zh: 'ArcGIS, QGIS, 空间分析与地图可视化。',
        en: 'ArcGIS, QGIS, spatial analysis and map visualization.',
      },
    },
    connections: [],
  },
  {
    id: 'skill-python',
    type: 'skill',
    label: { zh: 'Python', en: 'Python' },
    position: { x: 200, y: 350 },
    data: {
      proficiency: 0.88,
      description: {
        zh: '数据处理、机器学习、ABM 模拟。',
        en: 'Data processing, machine learning, and ABM simulation.',
      },
    },
    connections: ['skill-ai'],
  },
  {
    id: 'skill-ai',
    type: 'skill',
    label: { zh: 'AI / LLM', en: 'AI / LLM' },
    position: { x: -200, y: 300 },
    data: {
      proficiency: 0.75,
      description: {
        zh: 'LLM 应用开发，GraphRAG，智能代理。',
        en: 'LLM application development, GraphRAG, and AI agents.',
      },
    },
    connections: [],
  },
  {
    id: 'skill-typescript',
    type: 'skill',
    label: { zh: 'TypeScript', en: 'TypeScript' },
    position: { x: -500, y: -50 },
    data: {
      proficiency: 0.8,
      description: {
        zh: '类型安全的前端开发。',
        en: 'Type-safe frontend development.',
      },
    },
    connections: [],
  },
  {
    id: 'skill-abm',
    type: 'skill',
    label: { zh: 'ABM 模拟', en: 'ABM Simulation' },
    position: { x: 450, y: 50 },
    data: {
      proficiency: 0.7,
      description: {
        zh: '基于智能体的建模，用于城市演化模拟。',
        en: 'Agent-based modeling for simulating urban evolution.',
      },
    },
    connections: [],
  },

  // === 博客 ===
  {
    id: 'blog-kg-urban',
    type: 'blog',
    label: { zh: '知识图谱与城市治理', en: 'Knowledge Graphs and Urban Governance' },
    position: { x: -150, y: -400 },
    data: {
      excerpt: {
        zh: '探讨如何将知识图谱技术应用于城市治理中的数据孤岛问题...',
        en: 'Exploring how knowledge graph technology can break down data silos in urban governance...',
      },
      date: '2026-04-15',
      url: '#',
    },
    connections: ['caseflow'],
  },
  {
    id: 'blog-abm-intro',
    type: 'blog',
    label: { zh: 'ABM 入门指南', en: 'A Practical Guide to ABM' },
    position: { x: 150, y: -380 },
    data: {
      excerpt: {
        zh: '从城市规划视角入门 Agent Based Modeling 的实用指南...',
        en: 'A practical introduction to Agent Based Modeling from an urban planning perspective...',
      },
      date: '2026-03-20',
      url: '#',
    },
    connections: ['update-old-city', 'skill-abm'],
  },

  // === 数据可视化 ===
  {
    id: 'dataviz-city',
    type: 'dataviz',
    label: { zh: '城市热力图', en: 'Urban Heatmap' },
    position: { x: 450, y: 300 },
    data: {
      description: {
        zh: '基于 POI 数据的城市功能密度热力图，展示城市空间结构。',
        en: 'A heatmap of urban functional density based on POI data, revealing urban spatial structure.',
      },
      chartType: 'heatmap',
    },
    connections: ['skill-gis', 'skill-data-analysis'],
  },
  {
    id: 'dataviz-network',
    type: 'dataviz',
    label: { zh: '知识图谱可视化', en: 'Knowledge Graph Visualization' },
    position: { x: -450, y: 200 },
    data: {
      description: {
        zh: 'CaseFlow 中知识图谱的可视化探索：实体关系、路径分析。',
        en: 'Visual exploration of knowledge graphs in CaseFlow: entity relations and path analysis.',
      },
      chartType: 'network',
    },
    connections: ['caseflow', 'skill-react'],
  },
];
