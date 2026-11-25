import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BrandIcon } from "./Icons";

const NAV = [
  ["/dashboard", "Dashboard", "dashboard.view", "◫", "OVERVIEW"],
  ["/products", "Products", "products.view", "▦", "CATALOG"],
  ["/categories", "Categories", "products.manage", "⌗", "CATALOG"],
  ["/suppliers", "Suppliers", "contacts.manage", "⇣", "CONTACTS"],
  ["/customers", "Customers", "contacts.manage", "♧", "CONTACTS"],
  ["/purchases", "Purchases", "purchases.manage", "↙", "OPERATIONS"],
  ["/sales", "Sales", "sales.view", "↗", "OPERATIONS"],
  ["/movements", "Stock movements", "stock.view", "⇄", "OPERATIONS"],
  ["/reports", "Reports", "reports.view", "▤", "INSIGHTS"],
  ["/users", "Users", "users.manage", "♙", "ADMINISTRATION"],
];

export default function Layout() {
  const { user, ready, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const location = useLocation();
  useEffect(() => {
    const h = (e) => {
      const id = Math.random();
      setToasts((t) => [...t, { id, ...e.detail }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    };
    addEventListener("ims-toast", h);
    return () => removeEventListener("ims-toast", h);
  }, []);
  if (!ready) return <p className="p-8">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  const currentPage =
    NAV.find(([path]) => path === location.pathname)?.[1] || "Workspace";
  const groups = [...new Set(NAV.map(([, , , , group]) => group))];
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`app-sidebar ${open ? "sidebar-open" : ""}`}>
        <NavLink
          className="app-brand"
          to="/dashboard"
          onClick={() => setOpen(false)}
        >
          <span className="app-brand-mark">
            <BrandIcon />
          </span>
          <span>
            <b>stockwise</b>
            <small>INVENTORY, IN SYNC</small>
          </span>
          <span className="brand-plan">IMS</span>
        </NavLink>
        <div className="sidebar-caption">YOUR WORKSPACE</div>
        <nav className="sidebar-nav">
          {groups.map((group) => {
            const links = NAV.filter(
              ([, , permission, , section]) =>
                section === group && can(permission),
            );
            if (!links.length) return null;
            return (
              <div className="nav-group" key={group}>
                <span className="nav-group-title">{group}</span>
                {links.map(([to, label, , icon]) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "nav-link-active" : ""}`
                    }
                  >
                    <span className="nav-icon">{icon}</span>
                    <span>{label}</span>
                    {to === "/movements" && (
                      <span className="nav-link-arrow">↗</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-spark">✦</span>
            <b>Inventory, in sync.</b>
            <small>Every change leaves a trail.</small>
          </div>
          <div className="sidebar-account">
            <span className="account-avatar">
              {user.name?.slice(0, 1).toUpperCase()}
            </span>
            <span className="account-copy">
              <b>{user.name}</b>
              <small>{user.role}</small>
            </span>
            <button
              className="account-logout"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            <span>☰</span>
          </button>
          <div className="topbar-crumb">
            <span>WORKSPACE</span>
            <i>/</i>
            <b>{currentPage}</b>
          </div>
          <div className="topbar-right">
            <span className="topbar-status">
              <i /> SYSTEM ONLINE
            </span>
            <span className="topbar-divider" />
            <span className="topbar-date">
              {new Intl.DateTimeFormat("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              }).format(new Date())}
            </span>
            <span className="topbar-avatar">
              {user.name?.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main key={location.pathname} className="app-content">
          <Outlet />
        </main>
      </div>
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`app-toast ${t.bad ? "app-toast-bad" : ""}`}
          >
            <span>{t.bad ? "!" : "✓"}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
