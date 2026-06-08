import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { getRoleLabel } from "@/lib/routing";
import type { NavItem } from "@/types/domain";

interface AdminLayoutProps {
  navigation: NavItem[];
}

export function AdminLayout({ navigation }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const visibleNavigation = navigation.filter(
    (item) => !item.roles || (user ? item.roles.includes(user.role) : true),
  );

  return (
    <div className="min-h-screen" style={{ background: "#f0f2f5" }}>
      {/* Top Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "80px", maxWidth: "1400px", margin: "0 auto" }}>
          {/* Logo + Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "#e8eaf6", display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0,
            }}>
              <img
                alt="Municipality of Culasi seal"
                src="/culasi-seal.png"
                style={{ width: "40px", height: "40px", objectFit: "contain" }}
              />
            </div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: 0, lineHeight: 1.2 }}>
                Culasi Public Market Management System
              </h1>
              <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
                Culasi City Government - Public Market Division
              </p>
            </div>
          </div>

          {/* User + Logout */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e", margin: 0 }}>
                {user?.name ?? "Administrator"}
              </p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                {getRoleLabel(user?.role ?? "admin")}
              </p>
            </div>
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              style={{
                background: "#ef4444", color: "#fff", border: "none",
                borderRadius: "8px", padding: "10px 22px",
                fontSize: "14px", fontWeight: 600, cursor: "pointer",
              }}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Top Navigation Tabs */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 32px" }}>
        <div style={{ display: "flex", gap: "4px", maxWidth: "1400px", margin: "0 auto" }}>
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: "inline-block",
                padding: "14px 22px",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
                borderRadius: "6px 6px 0 0",
                color: isActive ? "#fff" : "#374151",
                background: isActive ? "#1e3a8a" : "transparent",
                transition: "all 0.15s",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Page Content */}
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px" }}>
        <Outlet />
      </main>
    </div>
  );
}
