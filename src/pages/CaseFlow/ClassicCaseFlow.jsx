import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import CaseFlow from './CaseFlow';
import './workspace.css';

/**
 * 经典布局（v1）包装：/caseflow/classic
 * 原样保留 CaseFlow.jsx，不随 2.0 演进；右上角悬浮按钮返回新版
 */
export default function ClassicCaseFlow() {
  return (
    <>
      <Link to="/caseflow" className="v2-back-link" title="返回 CaseFlow 2.0 工作台">
        <History size={13} /> 返回新版
      </Link>
      <CaseFlow />
    </>
  );
}
