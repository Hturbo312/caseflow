import { useCallback } from 'react';
import { useI18n } from '../../../../../i18n';
import { useToastStore } from '@components/Toast/ToastStore';

/**
 * Hook: Graph data export (GraphML / CSV / JSON)
 * Extracted from KnowledgeGraphCanvas/index.jsx
 */
export function useGraphExport(currentCaseId) {
  const { t } = useI18n();
  const { error: showError, success: showSuccess } = useToastStore();

  const getToken = () => localStorage.getItem('token');

  const handleExportGraph = useCallback(async (format) => {
    if (!currentCaseId) return;
    try {
      const token = getToken();
      const res = await fetch(`/api/cases/${currentCaseId}/export?format=${format}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`导出失败: HTTP ${res.status}`);
      const data = await res.json();

      if (format === 'graphml') {
        const blob = new Blob([data.graphml], { type: 'application/xml' });
        downloadBlob(blob, `${data.case_name || 'graph'}.graphml`);
      } else if (format === 'csv') {
        downloadBlob(new Blob([data.entities_csv], { type: 'text/csv' }), `${data.case_name || 'graph'}_entities.csv`);
        downloadBlob(new Blob([data.relations_csv], { type: 'text/csv' }), `${data.case_name || 'graph'}_relations.csv`);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${data.case?.name || 'graph'}.json`);
      }
      showSuccess(t('toast.exportSuccess'));
    } catch (e) {
      console.error('导出失败:', e);
      showError(t('toast.exportFailed') + e.message);
    }
  }, [currentCaseId, t, showSuccess, showError]);

  const handleExportAllCases = useCallback(async (format) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/cases/export-all?format=${format}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`导出失败: HTTP ${res.status}`);
      const data = await res.json();

      if (format === 'graphml') {
        downloadBlob(new Blob([data.graphml], { type: 'application/xml' }), 'caseflow-all.graphml');
      } else if (format === 'csv') {
        downloadBlob(new Blob([data.entities_csv], { type: 'text/csv' }), 'caseflow-all-entities.csv');
        downloadBlob(new Blob([data.relations_csv], { type: 'text/csv' }), 'caseflow-all-relations.csv');
      } else {
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'caseflow-all.json');
      }
      showSuccess(t('ai.exportAllSuccess', { cases: data.total_cases || 0 }));
    } catch (e) {
      console.error('导出全部案例失败:', e);
      showError(t('toast.exportFailed') + e.message);
    }
  }, [t, showSuccess, showError]);

  return { handleExportGraph, handleExportAllCases };
}

/** Helper: trigger browser download for a blob */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
