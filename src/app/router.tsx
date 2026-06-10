import { Suspense, lazy, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { adminNavigation, vendorNavigation } from "@/app/navigation";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AuthLayout } from "@/components/layout/auth-layout";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { getPortalHome, isBackOfficeRole } from "@/lib/routing";
import type { UserRole } from "@/types/domain";

const LoginPage = lazy(() =>
  import("@/pages/auth-pages").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/pages/auth-pages").then((module) => ({ default: module.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/pages/auth-pages").then((module) => ({ default: module.ForgotPasswordPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found-page").then((module) => ({ default: module.NotFoundPage })),
);
const AdminDashboardPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminVendorsPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminVendorsPage })),
);
const AdminApplicationsPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminApplicationsPage })),
);
const AdminStallsPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminStallsPage })),
);
const AdminBillingPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminBillingPage })),
);
const AdminPaymentsPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminPaymentsPage })),
);
const AdminReportsPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminReportsPage })),
);
const AdminNotificationsPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminNotificationsPage })),
);
const AdminViolationsPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminViolationsPage })),
);
const AdminStaffPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminStaffPage })),
);
const AdminSettingsPage = lazy(() =>
  import("@/pages/admin-pages").then((module) => ({ default: module.AdminSettingsPage })),
);
const VendorDashboardPage = lazy(() =>
  import("@/pages/vendor-pages").then((module) => ({ default: module.VendorDashboardPage })),
);
const VendorProfilePage = lazy(() =>
  import("@/pages/vendor-pages").then((module) => ({ default: module.VendorProfilePage })),
);
const VendorApplicationsPage = lazy(() =>
  import("@/pages/vendor-pages").then((module) => ({ default: module.VendorApplicationsPage })),
);
const VendorStallPage = lazy(() =>
  import("@/pages/vendor-pages").then((module) => ({ default: module.VendorBillingPage })),
);
const VendorBillingPage = lazy(() =>
  import("@/pages/vendor-pages").then((module) => ({ default: module.VendorBillingPage })),
);
const VendorNotificationsPage = lazy(() =>
  import("@/pages/vendor-pages").then((module) => ({ default: module.VendorNotificationsPage })),
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route element={<GuestOnlyRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>
          </Route>

          <Route element={<BackOfficeRoute />}>
            <Route
              path="/admin"
              element={<AdminLayout navigation={adminNavigation} />}
            >
              <Route index element={<Navigate replace to="dashboard" />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route
                path="vendors"
                element={
                  <RestrictedPage roles={["super_admin", "admin"]}>
                    <AdminVendorsPage />
                  </RestrictedPage>
                }
              />
              <Route
                path="applications"
                element={
                  <RestrictedPage roles={["super_admin", "admin"]}>
                    <AdminApplicationsPage />
                  </RestrictedPage>
                }
              />
              <Route path="documents" element={<Navigate replace to="/admin/applications" />} />
              <Route
                path="stalls"
                element={
                  <RestrictedPage roles={["super_admin", "admin"]}>
                    <AdminStallsPage />
                  </RestrictedPage>
                }
              />
              <Route path="billing" element={<AdminBillingPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route
                path="violations"
                element={
                  <RestrictedPage roles={["super_admin", "admin"]}>
                    <AdminViolationsPage />
                  </RestrictedPage>
                }
              />
              <Route
                path="staff"
                element={
                  <RestrictedPage roles={["super_admin"]}>
                    <AdminStaffPage />
                  </RestrictedPage>
                }
              />
              <Route
                path="settings"
                element={
                  <RestrictedPage roles={["super_admin", "admin"]}>
                    <AdminSettingsPage />
                  </RestrictedPage>
                }
              />
            </Route>
          </Route>

          <Route element={<VendorOnlyRoute />}>
            <Route
              path="/vendor"
              element={<PortalLayout navigation={vendorNavigation} portalName="Vendor Portal" />}
            >
              <Route index element={<Navigate replace to="dashboard" />} />
              <Route path="dashboard" element={<VendorDashboardPage />} />
              <Route path="profile" element={<VendorProfilePage />} />
              <Route path="applications" element={<VendorApplicationsPage />} />
              <Route path="documents" element={<Navigate replace to="/vendor/applications" />} />
              <Route path="stall" element={<VendorStallPage />} />
              <Route path="billing" element={<VendorBillingPage />} />
              <Route path="notifications" element={<VendorNotificationsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function RootRedirect() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return <RouteLoader />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate replace to="/login" />;
  }

  return <Navigate replace to={getPortalHome(user.role)} />;
}

function GuestOnlyRoute() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return <RouteLoader />;
  }

  if (isAuthenticated && user) {
    return <Navigate replace to={getPortalHome(user.role)} />;
  }

  return <Outlet />;
}

function BackOfficeRoute() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return <RouteLoader />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate replace to="/login" />;
  }

  if (!isBackOfficeRole(user.role)) {
    return <Navigate replace to={getPortalHome(user.role)} />;
  }

  return <Outlet />;
}

function VendorOnlyRoute() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return <RouteLoader />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate replace to="/login" />;
  }

  if (user.role !== "vendor") {
    return <Navigate replace to={getPortalHome(user.role)} />;
  }

  return <Outlet />;
}

function RestrictedPage({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate replace to={user ? getPortalHome(user.role) : "/login"} />;
  }

  return children;
}

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Loading portal module...
        </CardContent>
      </Card>
    </div>
  );
}
