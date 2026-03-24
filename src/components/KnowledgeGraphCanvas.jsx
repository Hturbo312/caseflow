import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ForceGraph2D from 'react-force-graph-2d';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Filter,
  Share2,
  Search,
  X,
  Route,
  Target,
  ArrowRight,
  Layers,
  Focus,
  GitBranch
} from 'lucide-react';
import { useGraphStore, useCaseStore, useSchemaStore } from '../store';

const KnowledgeGraphCanvas = () => {
  const fgRef = useRef(null);
  const {
    nodes, links,
    allNodes, allLinks,
    setHighlightedNodes, setSelectedNode, filter, setFilter, selectedNode,
    viewMode, focusDepth, focusCaseId,
    setViewMode, setFocusDepth, setFocusCase
  } = useGraphStore();
  const { getCurrentCase, cases } = useCaseStore();
  const { getCurrentSchema } = useSchemaStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);

  // 缩放控制状态
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomRef = useRef(1);

  // 路径分析状态
  const [showPathAnalysis, setShowPathAnalysis] = useState(false);
  const [pathStartNode, setPathStartNode] = useState(null);
  const [pathEndNode, setPathEndNode] = useState(null);
  const [pathResult, setPathResult] = useState([]);

  // 加载状态
  const [isLoading, setIsLoading] = useState(true);

  // 减少动画偏好
  const prefersReducedMotion = useReducedMotion();

  const currentSchema = getCurrentSchema();
  const currentCase = getCurrentCase();
  const focusCaseData = cases.find(c => c.id === focusCaseId);

  // 从 Schema 获取实体类型颜色
  const getEntityTypeColor = (typeName) => {
    const entityType = currentSchema?.entityTypes?.find(e => e.name === typeName);
    return entityType?.color || '#9ca3af';
  };

  // 节点颜色映射
  const getNodeColor = (type) => {
    return getEntityTypeColor(type);
  };

  // 处理节点点击
  const handleNodeClick = (node) => {
    // 如果正在进行路径分析，设置为起点或终点
    if (showPathAnalysis) {
      if (!pathStartNode || (pathStartNode && pathEndNode)) {
        setPathStartNode(node);
        setPathEndNode(null);
        setPathResult([]);
      } else {
        setPathEndNode(node);
        // 计算路径
        findPath(node.id, pathStartNode.id);
      }
    } else {
      setSelectedNode(node);
    }
  };

  // BFS 查找两个节点之间的路径
  const findPath = (startId, endId) => {
    const adjacencyList = {};

    // 构建邻接表
    links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (!adjacencyList[sourceId]) adjacencyList[sourceId] = [];
      if (!adjacencyList[targetId]) adjacencyList[targetId] = [];

      adjacencyList[sourceId].push({ target: targetId, link });
      adjacencyList[targetId].push({ target: sourceId, link });
    });

    // BFS 搜索
    const queue = [[startId]];
    const visited = new Set([startId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const node = path[path.length - 1];

      if (node === endId) {
        // 找到路径，提取路径上的链接
        const pathLinks = [];
        for (let i = 0; i < path.length - 1; i++) {
          const link = links.find(l => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            return (s === path[i] && t === path[i + 1]) || (s === path[i + 1] && t === path[i]);
          });
          if (link) pathLinks.push(link);
        }
        setPathResult(pathLinks);
        setHighlightedNodes(path.flatMap((_, i) => {
          if (i === path.length - 1) return [];
          const link = pathLinks[i];
          if (!link) return [];
          const s = typeof link.source === 'object' ? link.source.id : link.source;
          const t = typeof link.target === 'object' ? link.target.id : link.target;
          return [s, t];
        }));
        return;
      }

      const neighbors = adjacencyList[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.target)) {
          visited.add(neighbor.target);
          queue.push([...path, neighbor.target]);
        }
      }
    }

    // 未找到路径
    setPathResult([]);
    setHighlightedNodes([]);
  };

  // 重置路径分析
  const resetPathAnalysis = () => {
    setShowPathAnalysis(false);
    setPathStartNode(null);
    setPathEndNode(null);
    setPathResult([]);
    setHighlightedNodes([]);
  };

  // 缩放控制函数
  const handleZoomIn = useCallback(() => {
    if (fgRef.current) {
      const newZoom = zoomRef.current * 1.3;
      fgRef.current.zoom(newZoom, 500);
      zoomRef.current = newZoom;
      setZoomLevel(newZoom);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (fgRef.current) {
      const newZoom = zoomRef.current / 1.3;
      fgRef.current.zoom(newZoom, 500);
      zoomRef.current = newZoom;
      setZoomLevel(newZoom);
    }
  }, []);

  const handleFitToCanvas = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(500, 50);
      zoomRef.current = 1;
      setZoomLevel(1);
    }
  }, []);

  // 过滤节点 - 必须在 useEffect 之前定义
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filter.entityTypes && filter.entityTypes.length > 0 && !filter.entityTypes.includes(node.type)) {
        return false;
      }
      return true;
    });
  }, [nodes, searchQuery, filter.entityTypes]);

  // 过滤后的链接
  const filteredLinks = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return links.filter(link => {
      // 处理 force graph 可能将 source/target 转换为对象的情况
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });
  }, [filteredNodes, links]);

  const graphData = useMemo(() => ({
    nodes: filteredNodes,
    links: filteredLinks,
  }), [filteredNodes, filteredLinks]);

  // 使用 useMemo 缓存路径节点 ID
  const pathNodeIds = useMemo(() => {
    if (pathResult.length === 0) return new Set();
    const ids = new Set();
    pathResult.forEach(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      ids.add(s);
      ids.add(t);
    });
    return ids;
  }, [pathResult]);

  // 使用 useMemo 缓存路径链接 ID 用于快速查找
  const pathLinkIds = useMemo(() => {
    return new Set(pathResult.map(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      return `${s}-${t}`;
    }));
  }, [pathResult]);

  // 监听图谱初始化
  useEffect(() => {
    if (fgRef.current && nodes.length > 0) {
      // 初始化缩放
      fgRef.current.zoomToFit(500, 50);
    }
  }, [nodes.length]);

  // 键盘导航支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!fgRef.current || filteredNodes.length === 0) return;

      const currentIndex = selectedNode
        ? filteredNodes.findIndex(n => n.id === selectedNode.id)
        : -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < filteredNodes.length - 1 ? currentIndex + 1 : 0;
        setSelectedNode(filteredNodes[nextIndex]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredNodes.length - 1;
        setSelectedNode(filteredNodes[prevIndex]);
      } else if (e.key === 'Escape') {
        setSelectedNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredNodes, selectedNode, setSelectedNode]);

  return (
    <div className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
      {/* 顶部工具栏 */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary, #a855f7)' }}>
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">知识图谱画布</h2>
              <p className="text-sm text-gray-500">可视化关系拓扑</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 视图模式切换 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'full'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="全量模式：显示所有案例实体"
              >
                <Layers className="w-4 h-4" />
                全量
              </button>
              <button
                type="button"
                onClick={() => {
                  if (focusCaseId) {
                    setViewMode('focused');
                  }
                }}
                disabled={!focusCaseId}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'focused'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : focusCaseId
                      ? 'text-gray-600 hover:text-gray-900'
                      : 'text-gray-400 cursor-not-allowed'
                }`}
                title={focusCaseId ? '聚焦模式：显示选中案例及其邻居' : '请先选择一个案例'}
              >
                <Focus className="w-4 h-4" />
                聚焦
              </button>
            </div>

            {/* 聚焦深度选择器 */}
            {viewMode === 'focused' && focusCaseId && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200"
              >
                <GitBranch className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-700 font-medium">深度：</span>
                <div className="flex gap-1">
                  {[1, 2].map(depth => (
                    <button
                      key={depth}
                      type="button"
                      onClick={() => setFocusDepth(depth)}
                      className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                        focusDepth === depth
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-blue-600 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      {depth}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-blue-600 ml-1">
                  ({focusCaseData?.name || '未知案例'})
                </span>
              </motion.div>
            )}

            {/* 路径分析按钮 */}
            <button
              type="button"
              onClick={() => setShowPathAnalysis(!showPathAnalysis)}
              className={`px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                showPathAnalysis
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={showPathAnalysis ? { backgroundColor: 'var(--color-success, #22c55e)' } : {}}
            >
              <Route className="w-4 h-4" />
              路径分析
            </button>

            {/* 搜索框 */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索节点..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="搜索图谱节点"
                className="pl-9 pr-3 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-48"
              />
            </div>

            {/* 过滤按钮 */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-label={showFilters ? '关闭过滤器' : '打开过滤器'}
              aria-expanded={showFilters}
              className={`p-2.5 min-h-11 min-w-11 rounded-lg transition-colors ${
                showFilters ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>

            {/* 缩放控制 */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2.5 min-h-11 min-w-11 hover:bg-gray-50 transition-colors"
                aria-label="缩小"
                title="缩小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFitToCanvas}
                className="p-2.5 min-h-11 hover:bg-gray-50 transition-colors border-l border-gray-200 flex items-center gap-1"
                aria-label="适应画布"
                title="适应画布"
              >
                <Maximize className="w-4 h-4" />
                <span className="text-xs text-gray-500 pr-1">{Math.round(zoomLevel * 100)}%</span>
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2.5 min-h-11 min-w-11 hover:bg-gray-50 transition-colors border-l border-gray-200"
                aria-label="放大"
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 过滤面板 */}
        {showFilters && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
            className="mt-4 p-4 bg-gray-50 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">过滤器</h4>
              <button type="button" onClick={() => setShowFilters(false)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-2">实体类型</label>
                <div className="flex gap-2 flex-wrap">
                  {currentSchema?.entityTypes?.map(type => (
                    <button
                      type="button"
                      key={type.id}
                      onClick={() => {
                        const newTypes = filter.entityTypes.includes(type.name)
                          ? filter.entityTypes.filter(t => t !== type.name)
                          : [...filter.entityTypes, type.name];
                        setFilter({ entityTypes: newTypes });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filter.entityTypes.includes(type.name)
                          ? 'text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                      style={filter.entityTypes.includes(type.name) ? { backgroundColor: 'var(--color-primary, #a855f7)', borderColor: 'transparent' } : { borderColor: type.color }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }}></span>
                        {type.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 路径分析面板 */}
        {showPathAnalysis && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
            className="mt-4 p-4 bg-green-50 rounded-xl overflow-hidden border border-green-200"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-green-600" />
                <h4 className="text-sm font-semibold text-green-700">路径分析</h4>
              </div>
              <button type="button" onClick={resetPathAnalysis} className="p-1 hover:bg-green-200 rounded">
                <X className="w-3 h-3 text-green-600" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-green-600">起点：</span>
                {pathStartNode ? (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {pathStartNode.name}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">点击节点选择起点</span>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-green-600">终点：</span>
                {pathEndNode ? (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                    {pathEndNode.name}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">点击节点选择终点</span>
                )}
              </div>
            </div>
            {pathResult.length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <div className="text-xs text-green-600 mb-2">
                  找到路径（{pathResult.length} 步）：
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {pathResult.map((link, index) => (
                    <React.Fragment key={link.id || index}>
                      {index > 0 && <ArrowRight className="w-3 h-3 text-gray-400" />}
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        {link.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            {pathStartNode && pathEndNode && pathResult.length === 0 && (
              <div className="mt-3 text-xs text-gray-400 italic">
                未找到两个节点之间的路径
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* 画布区域 */}
      <div
        className="flex-1 relative bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden"
        role="img"
        aria-label={`知识图谱：${filteredNodes.length} 个节点，${filteredLinks.length} 条关系`}
      >
        {/* 隐藏的节点列表供屏幕阅读器使用 */}
        <div className="sr-only" role="list" aria-label="图谱节点列表">
          {filteredNodes.map(node => (
            <div key={node.id} role="listitem">
              {node.name} - {node.type}
            </div>
          ))}
        </div>

        {/* 空状态 */}
        {filteredNodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <Share2 className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-400" />
              <p className="text-lg font-medium text-gray-700 mb-2">暂无图谱数据</p>
              <p className="text-sm text-gray-500 mb-4">请选择一个案例或添加实体和关系</p>
              <button
                type="button"
                onClick={() => {/* 切换到案例详情 */}}
                className="px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
                style={{ backgroundColor: 'var(--color-primary, #3b82f6)' }}
              >
                添加实体
              </button>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeLabel="name"
            nodeColor={node => {
              // 路径上的节点高亮
              if (pathNodeIds.size > 0 && pathNodeIds.has(node.id)) {
                return '#22c55e'; // 路径节点绿色高亮
              }
              // 起点和终点特殊标记
              if (pathStartNode && node.id === pathStartNode.id) return '#3b82f6';
              if (pathEndNode && node.id === pathEndNode.id) return '#a855f7';

              // 聚焦模式下，高亮聚焦案例的节点
              if (viewMode === 'focused' && focusCaseId && node.caseId === focusCaseId) {
                return '#3b82f6'; // 聚焦案例节点蓝色
              }

              return getNodeColor(node.type);
            }}
            nodeRel={1}
            nodeVal={node => {
              // 路径上的节点和起点终点更大
              if (pathStartNode && node.id === pathStartNode.id) return 12;
              if (pathEndNode && node.id === pathEndNode.id) return 12;
              if (pathNodeIds.size > 0 && pathNodeIds.has(node.id)) return 10;

              // 聚焦模式下，聚焦案例节点稍大
              if (viewMode === 'focused' && focusCaseId && node.caseId === focusCaseId) {
                return 10;
              }

              return 8;
            }}
            linkLabel="name"
            linkColor={link => {
              // 路径上的链接高亮
              const s = typeof link.source === 'object' ? link.source.id : link.source;
              const t = typeof link.target === 'object' ? link.target.id : link.target;
              if (pathLinkIds.has(`${s}-${t}`)) {
                return '#22c55e';
              }
              return '#9ca3af';
            }}
            linkWidth={link => {
              // 路径上的链接更粗
              const s = typeof link.source === 'object' ? link.source.id : link.source;
              const t = typeof link.target === 'object' ? link.target.id : link.target;
              if (pathLinkIds.has(`${s}-${t}`)) {
                return 3;
              }
              return 1;
            }}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            onNodeClick={handleNodeClick}
            onNodeHover={node => {
              setHoveredNode(node);
              if (fgRef.current) {
                fgRef.current.container().style.cursor = node ? 'pointer' : null;
              }
            }}
            onEngineStop={() => setIsLoading(false)}
            cooldownTicks={100}
            forceEngine="d3"
            d3AlphaDecay={0.02}
          />
        )}

        {/* 加载指示器 */}
        {isLoading && filteredNodes.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10 pointer-events-none">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* 选中节点详情 */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              key="node-detail"
              initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
              className="absolute top-4 right-4 w-64 bg-white rounded-xl shadow-lg border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">节点详情</h4>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                  aria-label="关闭节点详情"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">名称</span>
                  <div className="font-medium">{selectedNode?.name}</div>
                </div>
                <div>
                  <span className="text-gray-500">类型</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getNodeColor(selectedNode?.type) }}
                    />
                    {selectedNode?.type}
                  </div>
                </div>
                {selectedNode?.caseName && (
                  <div>
                    <span className="text-gray-500">所属案例</span>
                    <div className="font-medium text-blue-600">{selectedNode?.caseName}</div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 图例 */}
        <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg border border-gray-200 p-3">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">
            {viewMode === 'focused' ? '聚焦案例' : '实体类型'}
          </h4>
          {viewMode === 'focused' && focusCaseId ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-600">当前案例节点</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-xs text-gray-600">邻居节点</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {currentSchema?.entityTypes?.map(type => (
                <div key={type.id} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="text-xs text-gray-600">{type.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>节点：{nodes.length} / {allNodes.length}</span>
            <span>关系：{links.length} / {allLinks.length}</span>
            <span className={`px-2 py-0.5 rounded ${
              viewMode === 'full' ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {viewMode === 'full' ? '全量模式' : `聚焦模式 · 深度 ${focusDepth}`}
            </span>
          </div>
          <span>
            {viewMode === 'focused' && focusCaseData
              ? `聚焦：${focusCaseData.name}`
              : `${currentSchema?.name || '未知 Schema'} · ${cases.filter(c => c.schemaId === currentSchema?.id).length} 案例`
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphCanvas;
