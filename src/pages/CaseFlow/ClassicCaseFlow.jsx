import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import CaseFlow from './CaseFlow';
import { useI18n } from '../../i18n';
import './workspace.css';

/**
 * 经典布局（v1）包装：/caseflow/classic
 * 原样保留 CaseFlow.jsx，不随 2.0 演进；右上角悬浮按钮返回新版
 */
export default function ClassicCaseFlow() {
  const { t } = useI18n();
  return (
    <>
      <Link to="/caseflow" className="v2-back-link" title={t('classic.backTitle')}>
        <History size={13} /> {t('classic.back')}
      </Link>
      <CaseFlow />
    </>
  );
}
