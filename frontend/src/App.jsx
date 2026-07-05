import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PaymentLink from "./pages/PaymentLink";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pay/:accountRef" element={<PaymentLink />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
