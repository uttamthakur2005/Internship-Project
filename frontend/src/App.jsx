import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./components/Login";
import { Dashboard } from "./pages/Dashboard";
import { Resource } from "./pages/Resource";
import { Transactions } from "./pages/Transactions";
import { Movements } from "./pages/Movements";
import { Reports } from "./pages/Reports";

const Gate = ({ p, children }) => {
  const { can } = useAuth();
  return can(p) ? children : <div className="card p-6">You do not have permission to open this page (403).</div>;
};

const Home = () => {
  const { can } = useAuth();
  return <Navigate to={can("dashboard.view") ? "/dashboard" : "/products"} replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Gate p="dashboard.view"><Dashboard /></Gate>} />
          {["products", "categories", "suppliers", "customers", "users"].map((k) => (
            <Route key={k} path={k} element={<Resource kind={k} />} />
          ))}
          <Route path="purchases" element={<Gate p="purchases.manage"><Transactions kind="purchases" /></Gate>} />
          <Route path="sales" element={<Gate p="sales.view"><Transactions kind="sales" /></Gate>} />
          <Route path="movements" element={<Gate p="stock.view"><Movements /></Gate>} />
          <Route path="reports" element={<Gate p="reports.view"><Reports /></Gate>} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
