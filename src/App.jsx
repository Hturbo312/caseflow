import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import CaseFlow from './pages/CaseFlow';
import './App.css';

function Home() {
  // 1. 在这里管理你的所有项目
  // 以后有新项目，直接在这里复制一行即可，无需修改下方的 HTML 结构
  const projects = [
    {
      id: 1,
      title: "CaseFlow",
      desc: "Based on Knowledge Graph Urban Case Management System. A standalone project detail page.",
      url: "/caseflow", 
      tags: ["React", "Tailwind CSS", "GraphRAG"],
      image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 2,
      title: "Interactive Studio",
      desc: "专注于极简交互设计的实验性项目，探索 Web 动效的边界。",
      url: "https://your-project-link-2.com",
      tags: ["Animation", "GSAP"],
      image: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 3,
      title: "Data Visualization Art",
      desc: "将复杂的数据转化为优雅的视觉图表，支持实时数据更新。",
      url: "https://your-project-link-3.com",
      tags: ["D3.js", "Canvas"],
      image: "https://images.unsplash.com/photo-1551288049-bbbda536339a?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 4,
      title: "E-commerce Redesign",
      desc: "为未来购物体验设计的概念性网页，采用全响应式布局。",
      url: "https://your-project-link-4.com",
      tags: ["Next.js", "Stripe"],
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800"
    }
  ];

  return (
    <div className="app">
      <div className="container">
        
        {/* 左侧：个人介绍 (在桌面端会吸顶固定) */}
        <aside className="profile-section">
          <div className="profile-content">
            <div className="avatar">
              {/* 这里可以换成你的真实照片链接 */}
              <div className="avatar-placeholder"></div>
            </div>
            <h1 className="name">Hturbo</h1>
            <p className="title">数据分析师 & 城市规划师</p>
            <p className="bio">
              Keep Going<br />
            </p>
            
            <div className="contact-info">
              <a href="wjl20010702@163.com" className="contact-link">Email</a>
              <a href="https://github.com/Hturbo312" target="_blank" rel="noopener noreferrer" className="contact-link">GitHub</a>
            </div>
          </div>
        </aside>

        {/* 右侧：项目展示区 (会自动填满剩余宽度) */}
        <main className="projects-section">
          <div className="projects-content">
            <h2 className="section-title">Projects</h2>
            
            <div className="projects-grid">
              {projects.map((project) => {
                const isInternal = project.url.startsWith('/');
                const CardContent = () => (
                  <>
                    <div className="project-image">
                      {/* 如果你有真实截图，把 placeholder 换成 <img src={project.image} /> */}
                      <div 
                        className="project-image-placeholder" 
                        style={{ 
                          backgroundImage: `url(${project.image})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      ></div>
                    </div>
                    
                    <h3 className="project-title">{project.title}</h3>
                    <p className="project-description">{project.desc}</p>
                    
                    <div className="project-tech">
                      {project.tags.map((tag, index) => (
                        <span key={index} className="tech-tag">{tag}</span>
                      ))}
                    </div>
                  </>
                );

                return isInternal ? (
                  <Link 
                    key={project.id} 
                    to={project.url}
                    className="project-card"
                  >
                    <CardContent />
                  </Link>
                ) : (
                  <a 
                    key={project.id} 
                    href={project.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="project-card"
                  >
                    <CardContent />
                  </a>
                );
              })}
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/caseflow" element={<CaseFlow />} />
    </Routes>
  );
}

export default App;
