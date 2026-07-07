import { HashRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PaymentLink from "./pages/PaymentLink";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pay/:accountRef" element={<PaymentLink />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
