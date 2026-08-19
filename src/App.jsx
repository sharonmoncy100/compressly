import { lazy, Suspense } from "react";

const Compressor = lazy(() => import("./compressor/Compressor"));
const HomePage = lazy(() => import("./HomePage"));

export default function App() {
  const path = window.location.pathname;
  const isCompressor = path === "/compress-image/" || path === "/compress-image";

  return (
    <Suspense fallback={null}>
      {isCompressor ? <Compressor /> : <HomePage />}
    </Suspense>
  );
}