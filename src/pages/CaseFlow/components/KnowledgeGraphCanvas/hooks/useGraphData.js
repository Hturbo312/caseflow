import { useState, useEffect, useCallback, useRef } from 'react';
import { useGraphStore, useCaseStore } from '@store';

/**
 * Custom hook for graph data management
 * Extracts graph initialization, container resize, and zoom control logic
 */
export const useGraphData = () => {
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
    loadAllCasesToGraph,
    initializeGraph,
    focusMode,
    focusCaseId,
    focusNodeId,
    setFocusMode,
    setFocusCase,
    setFocusNode,
    setFocusDepth
  } = useGraphStore();

  const { currentCaseId, setCurrentCase } = useCaseStore();

  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomRef = useRef(1);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize graph data
  useEffect(() => {
    if (nodes.length === 0) {
      // Reset loading state when graph is empty
    }
  }, [nodes.length]);

  // Container resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Auto-fit graph when dimensions change
  useEffect(() => {
    if (fgRef.current && nodes.length > 0 && dimensions.width > 0 && dimensions.height > 0) {
      const timer = setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.zoomToFit(300, 50);
          const actualZoom = fgRef.current.zoom();
          zoomRef.current = actualZoom;
          setZoomLevel(actualZoom);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dimensions, nodes.length]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      const newZoom = currentZoom * 1.3;
      fgRef.current.zoom(newZoom, 500);
      zoomRef.current = newZoom;
      setZoomLevel(newZoom);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      const newZoom = currentZoom / 1.3;
      fgRef.current.zoom(newZoom, 500);
      zoomRef.current = newZoom;
      setZoomLevel(newZoom);
    }
  }, []);

  const handleFitToCanvas = useCallback(() => {
    if (fgRef.current && nodes.length > 0) {
      fgRef.current.zoomToFit(500, 80);
      const actualZoom = fgRef.current.zoom();
      zoomRef.current = actualZoom;
      setZoomLevel(actualZoom);
    }
  }, [nodes.length]);

  // Handle engine stop for initial fit
  const handleEngineStop = useCallback(() => {
    setIsLoading(false);
    if (fgRef.current && nodes.length > 0) {
      fgRef.current.zoomToFit(500, 80);
      const actualZoom = fgRef.current.zoom();
      zoomRef.current = actualZoom;
      setZoomLevel(actualZoom);
    }
  }, [nodes.length]);

  return {
    // State
    nodes,
    links,
    selectedNode,
    selectedLink,
    filter,
    focusMode,
    focusCaseId,
    focusNodeId,
    currentCaseId,
    isLoading,
    dimensions,
    zoomLevel,
    setZoomLevel,
    zoomRef,
    containerRef,
    fgRef,

    // Actions
    setHighlightedNodes,
    setSelectedNode,
    setSelectedLink,
    setFilter,
    addNodeToGraph,
    addLinkToGraph,
    removeNodeFromGraph,
    removeLinkFromGraph,
    loadAllCasesToGraph,
    initializeGraph,
    setFocusMode,
    setFocusCase,
    setFocusNode,
    setFocusDepth,
    setCurrentCase,

    // Zoom controls
    handleZoomIn,
    handleZoomOut,
    handleFitToCanvas,
    handleEngineStop
  };
};

export default useGraphData;