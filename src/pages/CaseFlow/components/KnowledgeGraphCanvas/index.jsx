import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Share2, Globe, Focus } from 'lucide-react';
import { useCaseStore, useSchemaStore } from '@store';
import { useGraphData } from './hooks';
import { caseApi } from '@services/api';
import { useToastStore } from '@components/Toast/ToastStore';
import ConfirmModal from '@components/Toast/ConfirmModal';
import {
  buildAdjacencyList,
  bfsSearch,
  buildEntityTypeColorMap,
  buildRelationStyleMap,
  getNodeColor,
  filterNodes,
  filterLinksByNodeIds,
  getNodeIdFromRef,
  getPathNodeIds,
  getPathLinkIds,
  searchNodesByName,
  getSubgraphFromNode,
} from '@utils';
import { renderNode, renderLink } from './canvasRenderers';
// 子组件
import GraphToolbar from './GraphToolbar';
import GraphPathAnalysis from './GraphPathAnalysis';
import GraphEntityPanel from './GraphEntityPanel';
import GraphRelationPanel from './GraphRelationPanel';
import GraphLegend from './GraphLegend';
import GraphNodeDetail from './GraphNodeDetail';
import GraphLinkDetail from './GraphLinkDetail';

const KnowledgeGraphCanvas = ({ isAuthenticated, onShowLogin }) => {
  // 使用 useGraphData hook 获取图谱数据和缩放控制
  const {
    nodes,
    links,
    setHighlightedNodes,
    setSelectedNode,
    selectedNode,
    selectedLink,
    setSelectedLink,
    filter,
    setFilter,
    addNodeToGraph,
    addLinkToGraph,
    removeNodeFromGraph,
    removeLinkFromGraph,
    viewMode,
    setViewMode,
    focusCaseId,
    setFocusCase,
    currentCaseId,
    isLoading,
    dimensions,
    zoomLevel,
    setZoomLevel,
    zoomRef,
    containerRef,
    fgRef,
    handleZoomIn,
    handleZoomOut,
    handleFitToCanvas,
    handleEngineStop
  } = useGraphData();

  const { cases, addEntityToCase, addRelationToCase } = useCaseStore();
  const { schemas, currentSchemaId } = useSchemaStore();

  // Toast 通知
  const { error: showError, success: showSuccess, warning: showWarning } = useToastStore();

  // 直接从 schemas 获取当前 schema，确保实时更新
  const currentSchema = schemas.find(s => s.id === currentSchemaId || s.id === parseInt(currentSchemaId));

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 搜索状态
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchNode, setSelectedSearchNode] = useState(null);
  const [searchDepth, setSearchDepth] = useState(1);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 路径分析状态
  const [showPathAnalysis, setShowPathAnalysis] = useState(false);
  const [pathStartNode, setPathStartNode] = useState(null);
  const [pathEndNode, setPathEndNode] = useState(null);
  const [pathResult, setPathResult] = useState([]);

  // 实体创建抽屉状态
  const [entityDrawerOpen, setEntityDrawerOpen] = useState(false);
  const [entityForm, setEntityForm] = useState({ name: '', entityType: '', properties: {} });
  const [entitySaving, setEntitySaving] = useState(false);

  // 关系创建模式状态
  const [relationMode, setRelationMode] = useState(false);
  const [relationSource, setRelationSource] = useState(null);
  const [relationTarget, setRelationTarget] = useState(null);
  const [relationTypeSelectorOpen, setRelationTypeSelectorOpen] = useState(false);
  const [relationSaving, setRelationSaving] = useState(false);

  // 无案例提示状态
  const [showNoCaseAlert, setShowNoCaseAlert] = useState(false);

  // 删除确认弹窗状态
  const [deleteEntityModal, setDeleteEntityModal] = useState({ open: false, node: null });
  const [deleteRelationModal, setDeleteRelationModal] = useState({ open: false, link: null });

  // 当前案例
  const currentCase = cases.find(c => c.id === currentCaseId);

  // 从 Schema 获取实体类型颜色（直接依赖 entityTypes，确保实时更新）
  // 注意：必须定义在 handleSearchExecute 之前，因为后者依赖它
  const entityTypeColorMap = useMemo(() => {
    return buildEntityTypeColorMap(currentSchema?.entityTypes);
  }, [currentSchema?.entityTypes]);

  // 从 Schema 获取关系样式（颜色、线型、方向）
  const relationStyleMap = useMemo(() => {
    return buildRelationStyleMap(currentSchema?.relations);
  }, [currentSchema?.relations]);

  // 节点颜色获取函数（从 schema color map）
  const getNodeColorFromMap = useCallback((type) => {
    return getNodeColor(type, entityTypeColorMap);
  }, [entityTypeColorMap]);

  // 搜索执行（点击按钮触发）
  const handleSearchExecute = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSelectedSearchNode(null);
      return;
    }
    const results = searchNodesByName(nodes, searchQuery);
    // 添加颜色信息
    const resultsWithColor = results.map(node => ({
      ...node,
      color: getNodeColor(node.type, entityTypeColorMap)
    }));
    setSearchResults(resultsWithColor);
    setShowSearchResults(resultsWithColor.length > 0);
    // 如果只有一个结果，自动选中
    if (resultsWithColor.length === 1) {
      setSelectedSearchNode(resultsWithColor[0]);
      setShowSearchResults(false);
    } else {
      setSelectedSearchNode(null);
    }
  }, [searchQuery, nodes, entityTypeColorMap]);

  // 选择搜索结果中的节点
  const handleSelectSearchNode = useCallback((node) => {
    setSelectedSearchNode(node);
    setShowSearchResults(false);
    // 聚焦到该节点
    if (fgRef.current) {
      fgRef.current.centerAt(node.x || 0, node.y || 0, 500);
      fgRef.current.zoom(2, 500);
    }
  }, [fgRef]);

  // 深度变化时重新计算子图
  const handleSearchDepthChange = useCallback((depth) => {
    setSearchDepth(depth);
  }, []);

  // 清除搜索状态
  const clearSearchState = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedSearchNode(null);
    setShowSearchResults(false);
  }, []);

  // 构建邻接表（可缓存）
  const buildAdjacencyListLocal = useCallback(() => {
    return buildAdjacencyList(links);
  }, [links]);

  // BFS 搜索路径
  const bfsSearchLocal = useCallback((adjacencyList, startId, endId) => {
    return bfsSearch(adjacencyList, startId, endId, links);
  }, [links]);

  // 查找两个节点之间的路径
  const findPath = useCallback((startId, endId) => {
    const adjacencyList = buildAdjacencyListLocal();
    const result = bfsSearchLocal(adjacencyList, startId, endId);

    if (result) {
      setPathResult(result.pathLinks);
      setHighlightedNodes(result.path.flatMap((_, i) => {
        if (i === result.path.length - 1) return [];
        const link = result.pathLinks[i];
        if (!link) return [];
        const s = getNodeIdFromRef(link.source);
        const t = getNodeIdFromRef(link.target);
        return [s, t];
      }));
    } else {
      setPathResult([]);
      setHighlightedNodes([]);
    }
  }, [buildAdjacencyListLocal, bfsSearchLocal, setHighlightedNodes]);

  // 处理路径分析模式下的节点点击
  const handlePathAnalysisClick = useCallback((node) => {
    if (!pathStartNode || (pathStartNode && pathEndNode)) {
      setPathStartNode(node);
      setPathEndNode(null);
      setPathResult([]);
    } else {
      setPathEndNode(node);
      findPath(pathStartNode.id, node.id);
    }
  }, [pathStartNode, pathEndNode, findPath]);

  // 处理普通节点点击
  const handleNormalClick = useCallback((node) => {
    setSelectedNode(node);
    setSelectedLink(null);
  }, [setSelectedNode, setSelectedLink]);

  // 处理关系创建模式下的节点点击
  const handleRelationModeClick = useCallback((node) => {
    if (!relationSource) {
      // 设置起点
      setRelationSource(node);
    } else if (!relationTarget) {
      // 设置终点并打开关系类型选择
      setRelationTarget(node);
      setRelationTypeSelectorOpen(true);
    }
  }, [relationSource, relationTarget]);

  // 处理节点点击（路由逻辑）
  const handleNodeClick = useCallback((node) => {
    if (showPathAnalysis) {
      handlePathAnalysisClick(node);
    } else if (relationMode) {
      handleRelationModeClick(node);
    } else {
      handleNormalClick(node);
    }
  }, [showPathAnalysis, relationMode, handlePathAnalysisClick, handleRelationModeClick, handleNormalClick]);

  // 重置路径分析
  const resetPathAnalysis = useCallback(() => {
    setShowPathAnalysis(false);
    setPathStartNode(null);
    setPathEndNode(null);
    setPathResult([]);
    setHighlightedNodes([]);
  }, [setHighlightedNodes]);

  // 重置关系创建模式
  const resetRelationMode = useCallback(() => {
    setRelationMode(false);
    setRelationSource(null);
    setRelationTarget(null);
    setRelationTypeSelectorOpen(false);
  }, []);

  // 打开实体创建抽屉（先检查登录状态和案例）
  const handleEntityButtonClick = useCallback(() => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }
    if (!currentCaseId) {
      setShowNoCaseAlert(true);
      return;
    }
    setEntityForm({ name: '', entityType: currentSchema?.entityTypes?.[0]?.name || '', properties: {} });
    setEntityDrawerOpen(true);
  }, [isAuthenticated, onShowLogin, currentCaseId, currentSchema?.entityTypes]);

  // 处理关系按钮点击（先检查登录状态和案例）
  const handleRelationButtonClick = useCallback(() => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }
    if (!currentCaseId) {
      setShowNoCaseAlert(true);
      return;
    }
    setRelationMode(!relationMode);
    if (relationMode) {
      resetRelationMode();
    }
  }, [currentCaseId, relationMode, resetRelationMode]);

  // 保存实体
  const handleSaveEntity = useCallback(async () => {
    if (!entityForm.name.trim() || !entityForm.entityType) {
      showWarning('请填写实体名称和类型');
      return;
    }
    if (!currentCaseId) {
      showWarning('请先选择一个案例');
      return;
    }

    setEntitySaving(true);
    try {
      const newEntity = await addEntityToCase(currentCaseId, {
        name: entityForm.name,
        entityType: entityForm.entityType,
        properties: entityForm.properties
      });

      // 添加到图谱
      addNodeToGraph({
        id: newEntity.id,
        name: newEntity.name,
        type: newEntity.entityType,
        properties: newEntity.properties,
        caseId: currentCaseId
      });

      setEntityDrawerOpen(false);
      setEntityForm({ name: '', entityType: '', properties: {} });
      showSuccess('实体创建成功');
    } catch (error) {
      console.error('创建实体失败:', error);
      showError('创建实体失败: ' + error.message);
    }
    setEntitySaving(false);
  }, [entityForm, currentCaseId, addEntityToCase, addNodeToGraph, showWarning, showSuccess, showError]);

  // 创建关系
  const handleCreateRelation = useCallback(async (relationType) => {
    if (!relationSource || !relationTarget || !relationType) return;
    if (!currentCaseId) {
      showWarning('请先选择一个案例');
      return;
    }

    setRelationSaving(true);
    try {
      const newRelation = await addRelationToCase(currentCaseId, {
        sourceId: relationSource.id,
        targetId: relationTarget.id,
        name: relationType
      });

      // 添加到图谱
      addLinkToGraph({
        id: newRelation.id,
        source: relationSource.id,
        target: relationTarget.id,
        name: relationType,
        caseId: currentCaseId
      });

      resetRelationMode();
      showSuccess('关系创建成功');
    } catch (error) {
      console.error('创建关系失败:', error);
      showError('创建关系失败: ' + error.message);
    }
    setRelationSaving(false);
  }, [relationSource, relationTarget, currentCaseId, addRelationToCase, addLinkToGraph, resetRelationMode, showWarning, showSuccess, showError]);

  // 删除实体确认处理
  const handleDeleteEntityConfirm = useCallback(async () => {
    const node = deleteEntityModal.node;
    if (!node?.caseId || !node?.id) return;

    try {
      await caseApi.deleteEntity(node.caseId, node.id);
      removeNodeFromGraph(node.id);
      setSelectedNode(null);
      showSuccess('实体删除成功');
    } catch (error) {
      console.error('删除实体失败:', error);
      showError('删除实体失败: ' + error.message);
    }
    setDeleteEntityModal({ open: false, node: null });
  }, [deleteEntityModal.node, removeNodeFromGraph, setSelectedNode, showSuccess, showError]);

  // 删除关系确认处理
  const handleDeleteRelationConfirm = useCallback(async () => {
    const link = deleteRelationModal.link;
    if (!link?.caseId || !link?.linkId) return;

    try {
      await caseApi.deleteRelation(link.caseId, link.linkId);
      removeLinkFromGraph(link.linkId);
      setSelectedLink(null);
      showSuccess('关系删除成功');
    } catch (error) {
      console.error('删除关系失败:', error);
      showError('删除关系失败: ' + error.message);
    }
    setDeleteRelationModal({ open: false, link: null });
  }, [deleteRelationModal.link, removeLinkFromGraph, setSelectedLink, showSuccess, showError]);

  // 过滤节点（添加 null 检查）
  // 搜索子图模式：只显示选中节点及其邻居
  const subgraphData = useMemo(() => {
    if (selectedSearchNode) {
      const { nodeIds, linkIds } = getSubgraphFromNode(nodes, links, selectedSearchNode.id, searchDepth);
      const subNodes = nodes.filter(n => nodeIds.has(n.id));
      const subLinks = links.filter(l => linkIds.has(l.id));
      return { nodes: subNodes, links: subLinks, nodeIds, linkIds };
    }
    return null;
  }, [nodes, links, selectedSearchNode, searchDepth]);

  // 实体类型过滤（非搜索模式时）
  const typeFilteredNodes = useMemo(() => {
    return filterNodes(nodes, '', filter.entityTypes);
  }, [nodes, filter.entityTypes]);

  // 最终显示的节点（搜索模式优先，否则使用类型过滤）
  const filteredNodes = useMemo(() => {
    if (subgraphData) {
      // 搜索子图模式：先应用子图，再应用类型过滤
      if (filter.entityTypes.length > 0) {
        return subgraphData.nodes.filter(n => filter.entityTypes.includes(n.type));
      }
      return subgraphData.nodes;
    }
    return typeFilteredNodes;
  }, [subgraphData, typeFilteredNodes, filter.entityTypes]);

  // 最终显示的链接
  const filteredLinks = useMemo(() => {
    if (subgraphData) {
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      return subgraphData.links.filter(l => {
        const sourceId = getNodeIdFromRef(l.source);
        const targetId = getNodeIdFromRef(l.target);
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      });
    }
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return filterLinksByNodeIds(links, nodeIds);
  }, [subgraphData, filteredNodes, links]);

  // 子图节点ID集合（用于高亮）
  const subgraphNodeIds = useMemo(() => {
    return subgraphData?.nodeIds || new Set();
  }, [subgraphData]);

  const graphData = useMemo(() => ({
    nodes: filteredNodes,
    links: filteredLinks,
  }), [filteredNodes, filteredLinks]);

  // 使用 useMemo 缓存路径节点 ID
  const pathNodeIds = useMemo(() => {
    return getPathNodeIds(pathResult);
  }, [pathResult]);

  // 使用 useMemo 缓存路径链接 ID 用于快速查找
  const pathLinkIds = useMemo(() => {
    return getPathLinkIds(pathResult);
  }, [pathResult]);

  // 键盘导航支持（修复依赖问题，使用 ref 存储 selectedNode）
  const selectedNodeRef = useRef(selectedNode);
  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!fgRef.current || filteredNodes.length === 0) return;

      const currentIndex = selectedNodeRef.current
        ? filteredNodes.findIndex(n => n.id === selectedNodeRef.current.id)
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
  }, [filteredNodes, setSelectedNode]);

  // 配置力导向布局参数
  useEffect(() => {
    if (!fgRef.current) return;

    // 连接力：控制边的长度和强度
    fgRef.current.d3Force('link')
      ?.distance(70)
      ?.strength(0.7);

    // 节点斥力：防止节点聚集
    fgRef.current.d3Force('charge')
      ?.strength(-180)
      ?.distanceMin(25)
      ?.distanceMax(400);

    // 中心引力：将节点拉向画布中心
    fgRef.current.d3Force('center')
      ?.strength(0.1);

    // 重新加热模拟
    fgRef.current.d3ReheatSimulation();
  }, [graphData]);

  // ForceGraph2D 渲染函数（性能优化）
  const getNodeColorRender = useCallback((node) => {
    // 搜索子图模式：中心节点高亮为蓝色，邻居节点保持原色
    if (selectedSearchNode && node.id === selectedSearchNode.id) {
      return '#3b82f6';
    }
    if (pathNodeIds.size > 0 && pathNodeIds.has(node.id)) {
      return '#22c55e';
    }
    if (pathStartNode && node.id === pathStartNode.id) return '#3b82f6';
    if (pathEndNode && node.id === pathEndNode.id) return '#a855f7';
    // 关系创建模式高亮
    if (relationSource && node.id === relationSource.id) return '#22c55e';
    if (relationTarget && node.id === relationTarget.id) return '#22c55e';
    return getNodeColorFromMap(node.type);
  }, [selectedSearchNode, pathNodeIds, pathStartNode, pathEndNode, relationSource, relationTarget, getNodeColorFromMap]);

  const getNodeValRender = useCallback((node) => {
    // 搜索子图模式：中心节点放大
    if (selectedSearchNode && node.id === selectedSearchNode.id) return 14;
    if (pathStartNode && node.id === pathStartNode.id) return 12;
    if (pathEndNode && node.id === pathEndNode.id) return 12;
    if (pathNodeIds.size > 0 && pathNodeIds.has(node.id)) return 10;
    // 关系创建模式高亮
    if (relationSource && node.id === relationSource.id) return 12;
    if (relationTarget && node.id === relationTarget.id) return 12;
    return 8;
  }, [pathNodeIds, pathStartNode, pathEndNode, relationSource, relationTarget]);

  // Canvas 渲染函数（使用提取的纯函数，通过 useCallback 保持稳定引用）
  const handleNodeCanvasObject = useCallback((node, ctx, globalScale) => {
    renderNode({
      node,
      ctx,
      globalScale,
      selectedNode,
      pathStartNode,
      pathEndNode,
      relationSource,
      relationTarget,
      pathNodeIds,
      getNodeColor: getNodeColorRender,
      getNodeSize: getNodeValRender,
    });
  }, [selectedNode, pathStartNode, pathEndNode, relationSource, relationTarget, pathNodeIds, getNodeColorRender, getNodeValRender]);

  const handleLinkCanvasObject = useCallback((link, ctx) => {
    renderLink({
      link,
      ctx,
      relationStyleMap,
      pathLinkIds,
    });
  }, [relationStyleMap, pathLinkIds]);

  return (
    <div className="h-full bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      {/* 顶部工具栏 */}
      <GraphToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSearchExecute={handleSearchExecute}
        selectedSearchNode={selectedSearchNode}
        onSelectSearchNode={handleSelectSearchNode}
        searchDepth={searchDepth}
        onSearchDepthChange={handleSearchDepthChange}
        showSearchResults={showSearchResults}
        onToggleSearchResults={setShowSearchResults}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filter={filter}
        onFilterChange={setFilter}
        entityTypes={currentSchema?.entityTypes}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToCanvas={handleFitToCanvas}
        showPathAnalysis={showPathAnalysis}
        onTogglePathAnalysis={() => setShowPathAnalysis(!showPathAnalysis)}
        onEntityButtonClick={handleEntityButtonClick}
        relationMode={relationMode}
        onRelationButtonClick={handleRelationButtonClick}
        currentCaseId={currentCaseId}
        showNoCaseAlert={showNoCaseAlert}
        onDismissNoCaseAlert={() => setShowNoCaseAlert(false)}
      />

      {/* 路径分析面板 */}
      <div className="border-b border-gray-200 px-3 py-2 flex-shrink-0">
        <GraphPathAnalysis
          show={showPathAnalysis}
          onClose={resetPathAnalysis}
          nodes={nodes}
          pathStartNode={pathStartNode}
          pathEndNode={pathEndNode}
          pathResult={pathResult}
          onResetSelection={() => {
            setPathStartNode(null);
            setPathEndNode(null);
            setPathResult([]);
            setHighlightedNodes([]);
          }}
        />

        {/* 关系创建面板 */}
        <GraphRelationPanel
          relationMode={relationMode}
          relationSource={relationSource}
          relationTarget={relationTarget}
          onCloseMode={resetRelationMode}
          relationTypeSelectorOpen={relationTypeSelectorOpen}
          currentSchema={currentSchema}
          onSelectRelationType={handleCreateRelation}
          relationSaving={relationSaving}
          onCloseTypeSelector={() => setRelationTypeSelectorOpen(false)}
          onCancelSelection={() => {
            setRelationTypeSelectorOpen(false);
            setRelationTarget(null);
          }}
        />

        {/* 实体创建面板 */}
        <GraphEntityPanel
          open={entityDrawerOpen}
          onClose={() => setEntityDrawerOpen(false)}
          currentCase={currentCase}
          currentSchema={currentSchema}
          entityForm={entityForm}
          onFormChange={setEntityForm}
          onSave={handleSaveEntity}
          saving={entitySaving}
        />
      </div>

      {/* 画布区域 */}
      <div
        ref={containerRef}
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
              <p className="text-sm text-gray-500 mb-4">
                {currentCaseId
                  ? '点击上方"添加实体"按钮创建节点'
                  : '请先在右侧选择一个案例，或创建新案例'}
              </p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel="name"
            nodeColor={getNodeColorRender}
            nodeRel={1}
            nodeVal={getNodeValRender}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={handleNodeCanvasObject}
            linkLabel="name"
            linkWidth={1.5}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            onNodeClick={handleNodeClick}
            onLinkClick={(link) => {
              setSelectedLink(link);
              setSelectedNode(null);
            }}
            onNodeHover={(node) => {
              if (fgRef.current && fgRef.current.canvas) {
                fgRef.current.canvas().style.cursor = node ? 'pointer' : 'default';
              }
            }}
            onEngineStop={handleEngineStop}
            onZoom={(zoom) => {
              zoomRef.current = zoom;
              setZoomLevel(zoom);
            }}
            cooldownTicks={150}
            cooldownTime={10000}
            forceEngine="d3"
            d3AlphaDecay={0.012}
            d3VelocityDecay={0.35}
            warmupTicks={100}
            linkCanvasObjectMode={() => 'replace'}
            linkCanvasObject={handleLinkCanvasObject}
          />
        )}

        {/* 加载指示器 */}
        {isLoading && filteredNodes.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10 pointer-events-none">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* 选中节点详情 */}
        <GraphNodeDetail
          selectedNode={selectedNode}
          entityTypeColorMap={entityTypeColorMap}
          onClose={() => setSelectedNode(null)}
          onRequestDelete={(node) => setDeleteEntityModal({ open: true, node })}
        />

        {/* 选中连线详情 */}
        <GraphLinkDetail
          selectedLink={selectedLink}
          relationStyleMap={relationStyleMap}
          onClose={() => setSelectedLink(null)}
          onRequestDelete={(link) => setDeleteRelationModal({ open: true, link })}
        />

        {/* 图例 */}
        <GraphLegend entityTypes={currentSchema?.entityTypes} />
      </div>

      {/* 底部状态栏 */}
      <div className="border-t border-gray-200 px-3 py-2 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>节点：{filteredNodes.length}</span>
            <span>关系：{filteredLinks.length}</span>
            {/* 搜索子图提示 */}
            {selectedSearchNode && (
              <span className="text-blue-600 flex items-center gap-1">
                <Share2 className="w-3 h-3" />
                子图: {selectedSearchNode.name} (深度 {searchDepth})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              {selectedSearchNode
                ? `搜索子图模式`
                : viewMode === 'focused' ? `聚焦: ${currentCase?.name || '未选择'}` : '全局模式'}
            </span>
            {/* 模式切换按钮 */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={`h-7 px-2 transition-colors flex items-center gap-1 ${
                  viewMode === 'full' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="全局模式 - 显示当前Schema下的所有案例实体"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px]">全局</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentCaseId) {
                    setShowNoCaseAlert(true);
                    return;
                  }
                  setViewMode('focused');
                  setFocusCase(currentCaseId);
                }}
                className={`h-7 px-2 border-l border-gray-200 transition-colors flex items-center gap-1 ${
                  viewMode === 'focused' ? 'bg-purple-500 text-white' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={currentCaseId ? "聚焦模式 - 仅显示当前选中案例的实体" : "请先选择案例"}
              >
                <Focus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px]">聚焦</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 删除实体确认弹窗 */}
      <ConfirmModal
        isOpen={deleteEntityModal.open}
        onClose={() => setDeleteEntityModal({ open: false, node: null })}
        onConfirm={handleDeleteEntityConfirm}
        title="删除实体"
        message={`确定要删除实体"${deleteEntityModal.node?.name}"吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />

      {/* 删除关系确认弹窗 */}
      <ConfirmModal
        isOpen={deleteRelationModal.open}
        onClose={() => setDeleteRelationModal({ open: false, link: null })}
        onConfirm={handleDeleteRelationConfirm}
        title="删除关系"
        message="确定要删除此关系吗？此操作不可撤销。"
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />

      </div>
  );
};

export default KnowledgeGraphCanvas;