import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home/Home'));
const CaseFlowV2 = lazy(() => import('./pages/CaseFlow/CaseFlowV2'));
const ClassicCaseFlow = lazy(() => import('./pages/CaseFlow/ClassicCaseFlow'));

function App() {
  return (
    <Suspense fallback={<div className="loading-spinner">加载中...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* CaseFlow 2.0 三栏工作台（默认） */}
        <Route path="/caseflow" element={<CaseFlowV2 />} />
        {/* v1 经典布局保留入口：「上一版本」互通 */}
        <Route path="/caseflow/classic" element={<ClassicCaseFlow />} />
      </Routes>
    </Suspense>
  );
}

export default App;
