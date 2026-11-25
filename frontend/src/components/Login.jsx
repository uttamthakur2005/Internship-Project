import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BrandIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, ShieldIcon } from "./Icons";
import StockPath from "./StockPath";
import { errMsg } from "../api";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await login(f.email, f.password);
      nav("/");
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="showcase-orb showcase-orb-one" />
        <div className="showcase-orb showcase-orb-two" />
        <div className="showcase-grid" />
        <div className="showcase-content">
          <a className="brand-lockup" href="/login" aria-label="IMS home">
            <span className="brand-mark">
              <BrandIcon />
            </span>
            <span>
              <b>stockwise</b>
              <small>INVENTORY, IN SYNC</small>
            </span>
          </a>
          <div className="showcase-copy">
            <span className="eyebrow">
              <i /> YOUR BUSINESS, IN BALANCE
            </span>
            <h1>
              Make every
              <br />
              <span>move count.</span>
            </h1>
            <p>
              One clear view of your products, purchases and sales. Know what
              you have—and exactly why it changed.
            </p>
          </div>
          <StockPath />
          <div className="showcase-footer">
            <span>INVENTORY MANAGEMENT SYSTEM</span>
            <span>
              BUILT FOR BETTER BUSINESS <b>↗</b>
            </span>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-mobile-brand">
          <span className="brand-mark">
            <BrandIcon />
          </span>
          <b>stockwise</b>
        </div>
        <div className="login-card">
          <div className="login-heading">
            <span className="login-kicker">WELCOME BACK</span>
            <h2>
              Sign in to your
              <br />
              <span>workspace.</span>
            </h2>
            <p>Your inventory is right where you left it.</p>
          </div>
          <form onSubmit={go} className="login-form">
            <label className="login-field">
              <span>Email address</span>
              <span className="login-input-wrap">
                <MailIcon />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                />
              </span>
            </label>
            <label className="login-field">
              <span>Password</span>
              <span className="login-input-wrap">
                <LockIcon />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </span>
            </label>
            {err && (
              <p role="alert" className="login-error">
                <span>!</span>
                {err}
              </p>
            )}
            <button className="login-submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="login-spinner" />
                  Signing you in…
                </>
              ) : (
                <>
                  Sign in to dashboard <span>↗</span>
                </>
              )}
            </button>
          </form>
          <div className="login-security">
            <span>
              <ShieldIcon />
            </span>
            <p>
              <b>Your workspace is private</b>
              <small>Access is managed by your system administrator.</small>
            </p>
          </div>
          <p className="login-terms">
            No account yet? <b>Ask your administrator for access.</b>
          </p>
        </div>
        <div className="login-panel-footer">
          <span>© 2026 STOCKWISE IMS</span>
          <span>SECURE INVENTORY MANAGEMENT</span>
        </div>
      </section>
    </main>
  );
}
