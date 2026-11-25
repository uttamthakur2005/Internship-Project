import { createContext, useContext, useEffect, useState } from "react";
import { get, post } from "../api";

const Auth = createContext(null);
export const useAuth = () => useContext(Auth);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState([]);
  const [ready, setReady] = useState(!sessionStorage.getItem("ims_token"));
  useEffect(() => {
    if (sessionStorage.getItem("ims_token"))
      get("/auth/me")
        .then((r) => {
          setUser(r.data.user);
          setPerms(r.data.permissions);
        })
        .catch(() => sessionStorage.removeItem("ims_token"))
        .finally(() => setReady(true));
  }, []);
  const login = async (email, password) => {
    const r = await post("/auth/login", { email, password });
    sessionStorage.setItem("ims_token", r.data.token);
    setUser(r.data.user);
    setPerms(r.data.user.permissions);
    return r.data.user;
  };
  const logout = async () => {
    try {
      await post("/auth/logout");
    } catch {
      /* token already invalid */
    }
    sessionStorage.removeItem("ims_token");
    setUser(null);
    setPerms([]);
  };
  return (
    <Auth.Provider
      value={{
        user,
        perms,
        ready,
        login,
        logout,
        can: (p) => perms.includes(p),
      }}
    >
      {children}
    </Auth.Provider>
  );
}
