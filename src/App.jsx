import Compressor from "./compressor/Compressor";
import HomePage from "./HomePage";

export default function App() {
  const path = window.location.pathname;

  if (path === "/compress-image/" || path === "/compress-image") {
    return <Compressor />;
  }

  return <HomePage />;
}