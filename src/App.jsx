import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home/Home'));
const CaseFlow = lazy(() => import('./pages/CaseFlow/CaseFlow'));

function App() {
  return (
    <Suspense fallback={<div className="loading-spinner">加载中...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/caseflow" element={<CaseFlow />} />
      </Routes>
    </Suspense>
  );
}

export default App;