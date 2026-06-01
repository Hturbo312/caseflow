import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3Force from 'd3-force';
import { Share2, Globe, Focus } from 'lucide-react';
import { useCaseStore, useSchemaStore } from '@store';
import { useGraphData } from './hooks';
import { caseApi } from '@services/api';
import { useToastStore } from '@components/Toast/ToastStore';
import ConfirmModal from '@components/Toast/ConfirmModal';
import { useI18n } from '../../../../i18n';
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
import { renderNode, renderLink, buildSpatialGrid } from './canvasRenderers';
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
    focusMode,
    focusCaseId,
    focusNodeId,
    setFocusMode,
    setFocusCase,
    setFocusNode,
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
  const { t } = useI18n();

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

  // 图谱导出
  const handleExportGraph = useCallback(async (format) => {
    if (!currentCaseId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cases/${currentCaseId}/export?format=${format}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`导出失败: HTTP ${res.status}`);
      const data = await res.json();

      if (format === 'graphml') {
        // 下载 .graphml 文件
        const blob = new Blob([data.graphml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.case_name || 'graph'}.graphml`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        // 下载两个 CSV 文件
        const entitiesBlob = new Blob([data.entities_csv], { type: 'text/csv' });
        const eUrl = URL.createObjectURL(entitiesBlob);
        const eA = document.createElement('a');
        eA.href = eUrl;
        eA.download = `${data.case_name || 'graph'}_entities.csv`;
        eA.click();
        URL.revokeObjectURL(eUrl);

        const relationsBlob = new Blob([data.relations_csv], { type: 'text/csv' });
        const rUrl = URL.createObjectURL(relationsBlob);
        const rA = document.createElement('a');
        rA.href = rUrl;
        rA.download = `${data.case_name || 'graph'}_relations.csv`;
        rA.click();
        URL.revokeObjectURL(rUrl);
      } else {
        // JSON 下载
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.case?.name || 'graph'}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      showSuccess(t('toast.exportSuccess'));
    } catch (e) {
      console.error('导出失败:', e);
      showError(t('toast.exportFailed') + e.message);
    }
  }, [currentCaseId, t, showSuccess, showError]);

  // 导出全部案例图谱数据
  const handleExportAllCases = useCallback(async (format) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cases/export-all?format=${format}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`导出失败: HTTP ${res.status}`);
      const data = await res.json();

      if (format === 'graphml') {
        const blob = new Blob([data.graphml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'caseflow-all.graphml';
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        const entitiesBlob = new Blob([data.entities_csv], { type: 'text/csv' });
        const eUrl = URL.createObjectURL(entitiesBlob);
        const eA = document.createElement('a');
        eA.href = eUrl;
        eA.download = 'caseflow-all-entities.csv';
        eA.click();
        URL.revokeObjectURL(eUrl);

        const relationsBlob = new Blob([data.relations_csv], { type: 'text/csv' });
        const rUrl = URL.createObjectURL(relationsBlob);
        const rA = document.createElement('a');
        rA.href = rUrl;
        rA.download = 'caseflow-all-relations.csv';
        rA.click();
        URL.revokeObjectURL(rUrl);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'caseflow-all.json';
        a.click();
        URL.revokeObjectURL(url);
      }
      showSuccess(t('ai.exportAllSuccess', { cases: data.total_cases || 0 }));
    } catch (e) {
      console.error('导出全部案例失败:', e);
      showError(t('toast.exportFailed') + e.message);
    }
  }, [t, showSuccess, showError]);

  // Hover & focus state for dynamic highlighting
  const [hoveredNode, setHoveredNode] = useState(null);
  const [showLegend, setShowLegend] = useState(true);
  const lastClickTimeRef = useRef(0);
  const lastClickNodeRef = useRef(null);
  const handleNodeClickRef = useRef(null);

  // Derive focusedNode object from store for canvasRenderers compatibility
  const focusedNode = useMemo(() => {
    if (focusMode !== 'node' || !focusNodeId) return null;
    return nodes.find(n => n.id === focusNodeId) || null;
  }, [focusMode, focusNodeId, nodes]);

  // 删除确认弹窗状态
  const [deleteEntityModal, setDeleteEntityModal] = useState({ open: false, node: null });
  const [deleteRelationModal, setDeleteRelationModal] = useState({ open: false, link: null });
  // Handle node click with double-click detection
  const handleNodeClickWithDbl = useCallback((node) => {
    const now = Date.now();
    const timeDiff = now - lastClickTimeRef.current;
    const isSameNode = lastClickNodeRef.current && lastClickNodeRef.current.id === node.id;
    if (timeDiff < 350 && isSameNode) {
      if (focusMode === 'node' && focusNodeId === node.id) {
        setFocusNode(null);
      } else {
        setFocusNode(node);
      }
      lastClickTimeRef.current = 0;
      lastClickNodeRef.current = null;
    } else {
      handleNodeClickRef.current?.(node);
      lastClickTimeRef.current = now;
      lastClickNodeRef.current = node;
    }
  }, [focusMode, focusNodeId, setFocusNode]);

  const handleBackgroundClick = useCallback(() => {
    setFocusNode(null);
  }, [setFocusNode]);

  // Handle hover node
  const handleHoverNode = useCallback((node) => {
    if (focusMode === 'node') { setHoveredNode(null); return; }
    setHoveredNode(node);
  }, [focusMode]);

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

  // Keep handleNodeClickRef in sync
  useEffect(() => { handleNodeClickRef.current = handleNodeClick; }, [handleNodeClick]);

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
      showWarning(t('toast.fillNameType'));
      return;
    }
    if (!currentCaseId) {
      showWarning(t('toast.selectCaseFirst'));
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
      showSuccess(t('toast.entityCreated'));
    } catch (error) {
      console.error('创建实体失败:', error);
      showError(t('toast.entityCreateFailed') + error.message);
    }
    setEntitySaving(false);
  }, [entityForm, currentCaseId, addEntityToCase, addNodeToGraph, showWarning, showSuccess, showError]);

  // 创建关系
  const handleCreateRelation = useCallback(async (relationType) => {
    if (!relationSource || !relationTarget || !relationType) return;
    if (!currentCaseId) {
      showWarning(t('toast.selectCaseFirst'));
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
      showSuccess(t('toast.relationCreated'));
    } catch (error) {
      console.error('创建关系失败:', error);
      showError(t('toast.relationCreateFailed') + error.message);
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
      showSuccess(t('toast.entityDeleted'));
    } catch (error) {
      console.error('删除实体失败:', error);
      showError(t('toast.entityDeleteFailed') + error.message);
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
      showSuccess(t('toast.relationDeleted'));
    } catch (error) {
      console.error('删除关系失败:', error);
      showError(t('toast.relationDeleteFailed') + error.message);
    }
    setDeleteRelationModal({ open: false, link: null });
  }, [deleteRelationModal.link, removeLinkFromGraph, setSelectedLink, showSuccess, showError]);

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

  // 实体类型过滤
  const typeFilteredNodes = useMemo(() => {
    return filterNodes(nodes, '', filter.entityTypes);
  }, [nodes, filter.entityTypes]);

  // 最终显示的节点（搜索子图 > 类型过滤）
  const filteredNodes = useMemo(() => {
    if (subgraphData) {
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

  // Compute highlighted node IDs (1-hop neighbors of hovered node)
  const highlightedNodeIds = useMemo(() => {
    const activeNode = hoveredNode;
    if (!activeNode) return new Set();
    const neighbors = new Set([activeNode.id]);
    filteredLinks.forEach(link => {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;
      if (src === activeNode.id) neighbors.add(tgt);
      if (tgt === activeNode.id) neighbors.add(src);
    });
    return neighbors;
  }, [hoveredNode, filteredLinks]);

  // Compute node degrees for size mapping
  const nodeDegreeMap = useMemo(() => {
    const degreeMap = new Map();
    filteredLinks.forEach(link => {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;
      degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
      degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
    });
    return degreeMap;
  }, [filteredLinks]);

  const graphData = useMemo(() => {
    const nodesWithDegree = filteredNodes.map(n => ({ ...n, degree: nodeDegreeMap.get(n.id) || 0 }));
    return { nodes: nodesWithDegree, links: filteredLinks };
  }, [filteredNodes, filteredLinks, nodeDegreeMap]);

  // 使用 useMemo 缓存路径节点 ID
  const pathNodeIds = useMemo(() => {
    return getPathNodeIds(pathResult);
  }, [pathResult]);

  // 使用 useMemo 缓存路径链接 ID 用于快速查找
  const pathLinkIds = useMemo(() => {
    return getPathLinkIds(pathResult);
  }, [pathResult]);

  // 键盘导航支持 — 用 ref 避免 filteredNodes 变化导致频繁注册/注销
  const selectedNodeRef = useRef(selectedNode);
  const filteredNodesRef = useRef(filteredNodes);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);
  useEffect(() => { filteredNodesRef.current = filteredNodes; }, [filteredNodes]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const currentNodes = filteredNodesRef.current;
      if (!fgRef.current || currentNodes.length === 0) return;

      const currentIndex = selectedNodeRef.current
        ? currentNodes.findIndex(n => n.id === selectedNodeRef.current.id)
        : -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < currentNodes.length - 1 ? currentIndex + 1 : 0;
        setSelectedNode(currentNodes[nextIndex]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : currentNodes.length - 1;
        setSelectedNode(currentNodes[prevIndex]);
      } else if (e.key === 'Escape') {
        if (focusMode === 'node') {
          setFocusNode(null);
        } else if (focusMode === 'case') {
          setFocusMode('full');
        } else {
          setSelectedNode(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedNode, setFocusNode, focusMode]);

  // Force layout: wider spacing for CPI-style global labels
  const nodeCount = filteredNodes.length;
  const linkCount = filteredLinks.length;
  const communityKey = useMemo(() => filteredNodes.map(n => `${n.caseId}:${n.type}`).sort().join(','), [filteredNodes]);

  // Collision force to prevent node overlap — radius includes node visual + label area below
  const forceCollide = useMemo(() => {
    return d3Force.forceCollide().radius((node) => {
      const degree = node.degree || 0;
      let radius;
      if (degree >= 10) radius = 20;
      else if (degree >= 5) radius = 12;
      else if (degree >= 2) radius = 8;
      else radius = 4;
      // Label sits radius+4 below center, ~15px tall. Total clearance from center = radius + 24px.
      // Add another 8px gap between adjacent nodes.
      return radius + 32;
    }).strength(0.8).iterations(3);
  }, []);
  useEffect(() => {
    if (!fgRef.current) return;

    if (focusMode === 'node' || focusMode === 'case') {
      // Focus mode: strong links, moderate repulsion, compact layout
      fgRef.current.d3Force('link')?.distance(50)?.strength(1.0)?.iterations(3);
      fgRef.current.d3Force('charge')?.strength(-80)?.distanceMin(10)?.distanceMax(200);
      fgRef.current.d3Force('center')?.strength(0.15);
      fgRef.current.d3Force('x', null);
      fgRef.current.d3Force('y', null);
      fgRef.current.d3Force('collide', forceCollide);
    } else {
      // Global mode: case-based clustering with concepts in center
      fgRef.current.d3Force('link')?.distance(60)?.strength(0.6)?.iterations(2);
      fgRef.current.d3Force('charge')?.strength(-150)?.distanceMin(15)?.distanceMax(300);

      // Always ensure center force exists (it may have been nulled in focus mode)
      const center = fgRef.current.d3Force('center');
      if (center) {
        center.strength(0.05);
      } else {
        fgRef.current.d3Force('center', (a) => { filteredNodes.forEach(n => { n.x += (dimensions.width / 2 - n.x) * a * 0.05; n.y += (dimensions.height / 2 - n.y) * a * 0.05; }); });
      }

      // 按案例分簇：根据共享概念邻居相似度将案例分组成 ~8 个簇
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      const nonConceptNodes = filteredNodes.filter(n => n.type !== 'Concept');
      const conceptNodes = filteredNodes.filter(n => n.type === 'Concept');

      if (nonConceptNodes.length > 0) {
        // 1. 按 caseId 分组
        const caseGroups = new Map();
        for (const n of nonConceptNodes) {
          const cid = n.caseId ?? 'unknown';
          if (!caseGroups.has(cid)) caseGroups.set(cid, []);
          caseGroups.get(cid).push(n.id);
        }

        const caseIds = [...caseGroups.keys()];

        if (caseIds.length > 1) {
          // 2. 计算案例间相似度（共享案例数 Jaccard）
          const simMatrix = [];
          for (let i = 0; i < caseIds.length; i++) {
            simMatrix[i] = [];
            const setA = new Set(caseGroups.get(caseIds[i]));
            for (let j = 0; j < caseIds.length; j++) {
              if (i === j) { simMatrix[i][j] = 1; continue; }
              const setB = new Set(caseGroups.get(caseIds[j]));
              let intersection = 0;
              for (const id of setA) { if (setB.has(id)) intersection++; }
              const union = setA.size + setB.size - intersection;
              simMatrix[i][j] = union > 0 ? intersection / union : 0;
            }
          }

          // 3. 贪心聚类：将相似度高的案例分到同一簇（目标 8 个簇）
          const numClusters = Math.min(8, caseIds.length);
          const clusterAssignment = new Array(caseIds.length).fill(-1);
          const clusterSizes = new Array(numClusters).fill(0);
          const caseWeights = caseIds.map(cid => caseGroups.get(cid).length); // 按实体数排序
          const sortedIndices = caseIds.map((_, i) => i).sort((a, b) => caseWeights[b] - caseWeights[a]);

          // 按实体数从大到小分配
          let currentCluster = 0;
          for (const idx of sortedIndices) {
            if (clusterAssignment[idx] !== -1) continue;
            clusterAssignment[idx] = currentCluster;
            clusterSizes[currentCluster]++;
            // 找到最相似的未分配案例
            for (let round = 0; round < 3; round++) {
              let bestSim = -1, bestJ = -1;
              for (let j = 0; j < caseIds.length; j++) {
                if (clusterAssignment[j] === -1 && simMatrix[idx][j] > bestSim) {
                  bestSim = simMatrix[idx][j];
                  bestJ = j;
                }
              }
              if (bestJ >= 0 && bestSim > 0.1) {
                clusterAssignment[bestJ] = currentCluster;
                clusterSizes[currentCluster]++;
              } else break;
            }
            currentCluster = (currentCluster + 1) % numClusters;
          }

          // 4. 为每个簇分配圆周位置
          const cr = Math.min(dimensions.width, dimensions.height) * 0.32;
          const clusterCenters = [];
          for (let i = 0; i < numClusters; i++) {
            const angle = (2 * Math.PI * i) / numClusters - Math.PI / 2;
            clusterCenters.push({ x: cx + Math.cos(angle) * cr, y: cy + Math.sin(angle) * cr });
          }

          // 构建 caseId → 簇中心 的映射
          const caseCenterMap = new Map();
          for (let i = 0; i < caseIds.length; i++) {
            const ci = clusterAssignment[i];
            caseCenterMap.set(caseIds[i], clusterCenters[ci]);
          }

          fgRef.current.d3Force('x', (a) => {
            for (const n of filteredNodes) {
              if (n.type === 'Concept') {
                n.x += (cx - n.x) * a * 0.08;
              } else {
                const c = caseCenterMap.get(n.caseId ?? 'unknown');
                if (c) n.x += (c.x - n.x) * a * 0.04;
              }
            }
          });
          fgRef.current.d3Force('y', (a) => {
            for (const n of filteredNodes) {
              if (n.type === 'Concept') {
                n.y += (cy - n.y) * a * 0.08;
              } else {
                const c = caseCenterMap.get(n.caseId ?? 'unknown');
                if (c) n.y += (c.y - n.y) * a * 0.04;
              }
            }
          });
        } else {
          if (!fgRef.current.d3Force('x')) {
            fgRef.current.d3Force('x', () => {});
            fgRef.current.d3Force('y', () => {});
          }
        }
      } else {
        if (!fgRef.current.d3Force('x')) {
          fgRef.current.d3Force('x', () => {});
          fgRef.current.d3Force('y', () => {});
        }
      }
      fgRef.current.d3Force('collide', forceCollide);
    }
    fgRef.current.d3ReheatSimulation();
  }, [nodeCount, linkCount, communityKey, focusMode]);

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
    if (selectedSearchNode && node.id === selectedSearchNode.id) return 14;
    if (pathStartNode && node.id === pathStartNode.id) return 12;
    if (pathEndNode && node.id === pathEndNode.id) return 12;
    if (pathNodeIds.size > 0 && pathNodeIds.has(node.id)) return 10;
    if (relationSource && node.id === relationSource.id) return 12;
    if (relationTarget && node.id === relationTarget.id) return 12;
    const degree = node.degree || 0;
    if (degree >= 10) return 40;
    if (degree >= 5) return 24;
    if (degree >= 2) return 12;
    return 4;
  }, [selectedSearchNode, pathNodeIds, pathStartNode, pathEndNode, relationSource, relationTarget]);

  // Spatial grid for O(n) collision detection — rebuilt per render frame
  const spatialGrid = useMemo(() => {
    return buildSpatialGrid(filteredNodes, getNodeValRender, 60);
  }, [filteredNodes, getNodeValRender]);

  // Canvas 渲染函数（使用提取的纯函数，通过 useCallback 保持稳定引用）
  const handleNodeCanvasObject = useCallback((node, ctx, globalScale) => {
    renderNode({
      node, ctx, globalScale, selectedNode,
      hoveredNode, focusedNode, highlightedNodeIds,
      pathStartNode, pathEndNode, relationSource, relationTarget,
      pathNodeIds, getNodeColor: getNodeColorRender, getNodeSize: getNodeValRender,
      spatialGrid,
    });
  }, [selectedNode, hoveredNode, focusedNode, highlightedNodeIds, pathStartNode, pathEndNode, relationSource, relationTarget, pathNodeIds, getNodeColorRender, getNodeValRender, spatialGrid]);

  const handleLinkCanvasObject = useCallback((link, ctx) => {
    renderLink({ link, ctx, relationStyleMap, pathLinkIds, highlightedNodeIds });
  }, [relationStyleMap, pathLinkIds, highlightedNodeIds]);

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
        onExport={handleExportGraph}
        totalCases={cases?.length || 0}
        onExportAll={handleExportAllCases}
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
        className="flex-1 relative bg-white overflow-hidden"
        role="img"
        aria-label={`${t('toolbar.title')}：${filteredNodes.length} ${t('status.nodes')}，${filteredLinks.length} ${t('status.links')}`}
      >
        {/* 隐藏的节点列表供屏幕阅读器使用 */}
        <div className="sr-only" role="list" aria-label={t('toolbar.title')}>
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
              <p className="text-lg font-medium text-gray-700 mb-2">{t('empty.graphTitle')}</p>
              <p className="text-sm text-gray-500 mb-4">
                {currentCaseId
                  ? t('empty.graphHint')
                  : t('empty.graphHintNoCase')}
              </p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            key={`graph-${focusMode}-${focusNodeId ?? ''}-${focusCaseId ?? ''}`}
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
            onNodeClick={handleNodeClickWithDbl}
            onLinkClick={(link) => {
              setSelectedLink(link);
              setSelectedNode(null);
            }}
            onNodeHover={(node) => {
              handleHoverNode(node);
              if (fgRef.current && fgRef.current.canvas) {
                fgRef.current.canvas().style.cursor = node ? 'pointer' : 'default';
              }
            }}
            onBackgroundClick={handleBackgroundClick}
            onEngineStop={handleEngineStop}
            onZoom={(zoom) => {
              zoomRef.current = zoom;
              setZoomLevel(zoom);
            }}
            cooldownTicks={30}
            cooldownTime={5000}
            forceEngine="d3"
            d3AlphaDecay={0.025}
            d3VelocityDecay={0.6}
            warmupTicks={300}
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
        {showLegend && <GraphLegend entityTypes={currentSchema?.entityTypes} onClose={() => setShowLegend(false)} />}
        {!showLegend && (
          <button
            onClick={() => setShowLegend(true)}
            className="absolute bottom-4 left-4 p-2 bg-white/90 rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-xs"
            title={t('legend.show')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="border-t border-gray-200 px-2 py-1.5 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="sm:hidden">{filteredNodes.length}/{filteredLinks.length}</span>
            <span className="hidden sm:inline">{t('status.nodes')}：{filteredNodes.length}</span>
            <span className="hidden sm:inline">{t('status.links')}：{filteredLinks.length}</span>
            {/* 搜索子图提示 */}
            {selectedSearchNode && (
              <span className="text-blue-600 flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
                <Share2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{selectedSearchNode.name}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline">
              {selectedSearchNode
                ? t('status.subgraph')
                : focusMode === 'case' ? `${t('status.caseFocus')}: ${currentCase?.name || t('case.unspecified')}`
                : focusMode === 'node' ? t('status.nodeFocus')
                : t('status.global')}
            </span>
            {/* 模式切换按钮 */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setFocusMode('full')}
                className={`h-8 w-8 sm:h-7 sm:w-auto sm:px-2 transition-colors flex items-center justify-center sm:gap-1 ${
                  focusMode === 'full' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={t('status.global')}
              >
                <Globe className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline text-[10px]">{t('status.globalBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentCaseId) {
                    setShowNoCaseAlert(true);
                    return;
                  }
                  setFocusMode('case');
                  setFocusCase(currentCaseId);
                }}
                className={`h-8 w-8 sm:h-7 sm:w-auto sm:px-2 border-l border-gray-200 transition-colors flex items-center justify-center sm:gap-1 ${
                  focusMode === 'case' ? 'bg-purple-500 text-white' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={currentCaseId ? t('status.caseFocus') : t('toolbar.selectCaseFirst')}
              >
                <Focus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline text-[10px]">{t('status.focusBtn')}</span>
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
        title={t('delete.entity.title')}
        message={t('delete.entity.message', { name: deleteEntityModal.node?.name })}
        confirmText={t('delete.confirm')}
        cancelText={t('delete.cancel')}
        variant="danger"
      />

      {/* 删除关系确认弹窗 */}
      <ConfirmModal
        isOpen={deleteRelationModal.open}
        onClose={() => setDeleteRelationModal({ open: false, link: null })}
        onConfirm={handleDeleteRelationConfirm}
        title={t('delete.link.title')}
        message={t('delete.link.message')}
        confirmText={t('delete.confirm')}
        cancelText={t('delete.cancel')}
        variant="danger"
      />

      </div>
  );
};

export default KnowledgeGraphCanvas;