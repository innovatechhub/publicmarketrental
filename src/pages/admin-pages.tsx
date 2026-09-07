import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Activity,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Download,
  LayoutGrid,
  List,
  MapPinned,
  PencilLine,
  Plus,
  Printer,
  ExternalLink,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ReportFilters } from "@/features/reports/report-filters";
import { useAuth } from "@/features/auth/auth-context";
import {
  createBilling,
  createPayment,
  createWalkInApplication,
  deleteVendor,
  deleteStall,
  fetchAdminDashboardSnapshot,
  fetchApplicationDocuments,
  fetchApplications,
  fetchBillings,
  fetchNotifications,
  fetchPayments,
  fetchReports,
  fetchSectionOptions,
  fetchSettings,
  fetchStaff,
  fetchStallOptions,
  fetchStalls,
  fetchUserOptions,
  fetchVendorOptions,
  fetchVendorLeaseRates,
  fetchVendorRegistry,
  fetchViolations,
  completeApplicationAssignment,
  saveDocumentRequirement,
  saveStall,
  saveSystemSetting,
  saveViolation,
  reviewPayment,
  toggleAdminNotificationRead,
  updateApplicationReview,
  updateBilling,
  updateDocumentVerification,
  updateStaffRecord,
  updateVendorRecord,
  type AdminOption,
  type AdminStallRecord,
  type ReportFiltersInput,
  createAdminNotification,
  deleteAdminNotification,
  deleteViolation,
} from "@/integrations/supabase/admin-service";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StallHeatMap } from "@/components/shared/stall-heat-map";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const queryKeys = {
  dashboard: ["admin-dashboard-live"],
  vendors: ["admin-vendors"],
  applications: ["admin-applications"],
  applicationDocuments: (id: string) => ["admin-application-documents", id],
  stalls: ["admin-stalls"],
  billings: ["admin-billings"],
  payments: ["admin-payments"],
  violations: ["admin-violations"],
  notifications: ["admin-notifications"],
  staff: ["admin-staff"],
  settings: ["admin-settings"],
  sectionOptions: ["admin-section-options"],
  stallOptions: ["admin-stall-options"],
  userOptions: ["admin-user-options"],
  vendorOptions: ["admin-vendor-options"]
} as const;

const defaultReportFilters: ReportFiltersInput = {
  month: "All months",
  year: String(new Date().getFullYear()),
  section: "All blocks",
  stallNumber: "",
  vendorName: "",
  paymentStatus: "Any status",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: fetchAdminDashboardSnapshot,
    enabled: isSupabaseConfigured,
  });

  const totalStalls = data ? (data.metrics.find((m) => m.label.toLowerCase().includes("stall"))?.value ?? 0) : 0;
  const occupied = data ? (data.metrics.find((m) => m.label.toLowerCase().includes("occup"))?.value ?? 0) : 0;
  const vacant = typeof totalStalls === "number" && typeof occupied === "number" ? totalStalls - occupied : 0;
  const monthlyRevenue = data?.metrics.find((m) => m.label.toLowerCase().includes("revenue") || m.label.toLowerCase().includes("collect"));
  const occupancyRate = data?.metrics.find((m) => m.label.toLowerCase().includes("occupancy") && m.label.toLowerCase().includes("rate"));
  const paidThisMonth = data?.metrics.find((m) => m.label.toLowerCase().includes("paid") || m.label.toLowerCase().includes("payment"));
  const overduePayments = data?.metrics.find((m) => m.label.toLowerCase().includes("overdue") || m.label.toLowerCase().includes("unpaid"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1e3a8a", margin: 0, letterSpacing: "0.02em" }}>
        DASHBOARD OVERVIEW
      </h2>

      {isPending ? <LoadingCard message="Loading admin dashboard..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}

      {!isPending && !error && data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
            <MockupStatCard accent="#1e3a8a" icon={<SquareStackIcon />} label="TOTAL STALLS" value={String(totalStalls)} valueColor="#1e3a8a" />
            <MockupStatCard accent="#16a34a" icon={<CheckSquareIcon />} label="OCCUPIED" value={String(occupied)} valueColor="#16a34a" />
            <MockupStatCard accent="#6b7280" icon={<EmptySquareIcon />} label="VACANT" value={String(vacant)} valueColor="#374151" />
            <MockupStatCard accent="#16a34a" icon={<PesoCircleIcon />} label="MONTHLY REVENUE" value={monthlyRevenue ? String(monthlyRevenue.value) : "₱0"} valueColor="#16a34a" />
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a8a", marginBottom: "20px", marginTop: 0 }}>QUICK STATISTICS</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
              <QuickStat accent="#1e3a8a" label="OCCUPANCY RATE" value={occupancyRate ? String(occupancyRate.value) : `${Number(totalStalls) > 0 ? ((Number(occupied) / Number(totalStalls)) * 100).toFixed(1) : "0.0"}%`} valueColor="#1e3a8a" />
              <QuickStat accent="#16a34a" label="PAID THIS MONTH" value={paidThisMonth ? String(paidThisMonth.value) : "0"} valueColor="#16a34a" />
              <QuickStat accent="#ef4444" label="OVERDUE PAYMENTS" value={overduePayments ? String(overduePayments.value) : "0"} valueColor="#ef4444" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "16px" }}>
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
              <p style={{ fontWeight: 600, color: "#111827", marginBottom: "4px", marginTop: 0 }}>Occupancy by section</p>
              <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px", marginTop: 0 }}>Occupied versus available stalls by market section</p>
              <div style={{ height: "280px" }}>
                <Bar data={{ labels: data.occupancyBySection.map((i) => i.section), datasets: [{ label: "Occupied", data: data.occupancyBySection.map((i) => i.occupied), backgroundColor: "#1e3a8a", borderRadius: 4 }, { label: "Available", data: data.occupancyBySection.map((i) => i.available), backgroundColor: "#16a34a", borderRadius: 4 }] }} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, responsive: true }} />
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
              <p style={{ fontWeight: 600, color: "#111827", marginBottom: "4px", marginTop: 0 }}>Monthly payment collections</p>
              <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px", marginTop: 0 }}>Collection performance by month</p>
              <div style={{ height: "280px" }}>
                <Line data={{ labels: data.monthlyCollections.map((i) => i.month), datasets: [{ label: "Collected", data: data.monthlyCollections.map((i) => i.collected), borderColor: "#1e3a8a", backgroundColor: "rgba(30,58,138,0.1)", tension: 0.35 }, { label: "Target", data: data.monthlyCollections.map((i) => i.target), borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,0.1)", tension: 0.35 }] }} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, responsive: true }} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MockupStatCard({ label, value, valueColor, accent, icon }: { label: string; value: string; valueColor: string; accent: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", borderLeft: `4px solid ${accent}`, padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ color: accent, opacity: 0.6 }}>{icon}</span>
      </div>
      <span style={{ fontSize: "34px", fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</span>
    </div>
  );
}

function QuickStat({ label, value, valueColor, accent }: { label: string; value: string; valueColor: string; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderLeft: `3px solid ${accent}`, paddingLeft: "12px" }}>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: "28px", fontWeight: 700, color: valueColor }}>{value}</span>
    </div>
  );
}

function SquareStackIcon() { return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>; }
function CheckSquareIcon() { return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function EmptySquareIcon() { return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>; }
function PesoCircleIcon() { return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9 8h4a2 2 0 0 1 0 4H9m0 0h5m-5 0v4" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

// ─── Vendors ──────────────────────────────────────────────────────────────────

export function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.vendors, queryFn: fetchVendorRegistry, enabled: isSupabaseConfigured });
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", businessName: "", businessType: "", status: "Active" });

  const openEdit = (id: string) => {
    const v = data?.rows.find((r) => r.id === id);
    if (!v) return;
    setEditId(id);
    setForm({ fullName: v.fullName, email: v.email, phone: v.phone, businessName: v.businessName, businessType: v.businessType, status: v.status });
  };

  const selected = data?.rows.find((r) => r.id === editId);
  const selectedForDelete = data?.rows.find((r) => r.id === deleteId);

  const saveVendor = useMutation({
    mutationFn: async () => updateVendorRecord(user!.id, { profileId: selected!.profileId, vendorId: selected!.id, ...form }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.vendors }); toast.success("Vendor record updated."); setEditId(null); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const notifyVendor = useMutation({
    mutationFn: async () => createAdminNotification(user!.id, { userId: selected!.profileId, title: "Account update", message: `${form.businessName} was updated by the market office.`, type: "update", link: "/vendor/profile" }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.notifications }); toast.success("Vendor notification sent."); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const removeVendor = useMutation({
    mutationFn: async () => deleteVendor(user!.id, deleteId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stalls }),
        queryClient.invalidateQueries({ queryKey: queryKeys.billings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.payments }),
        queryClient.invalidateQueries({ queryKey: queryKeys.violations }),
      ]);
      toast.success("Vendor deleted.");
      setDeleteId(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1e3a8a", margin: 0 }}>VENDOR MANAGEMENT</h2>
        <button
          onClick={() => {}}
          style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          type="button"
        >
          <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span> Add New Vendor
        </button>
      </div>
      {isPending ? <LoadingCard message="Loading vendor registry..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
      {data ? (
        <MockupTable
          head={["STALL #", "VENDOR NAME", "CONTACT", "TYPE", "RENT", "PAYMENT STATUS", "ACTIONS"]}
        >
          {data.rows.map((item) => (
            <MockupTr key={item.id}>
              <MockupTd><span style={{ fontWeight: 600 }}>{item.assignedStall || "—"}</span></MockupTd>
              <MockupTd>{item.fullName}</MockupTd>
              <MockupTd>
                <div style={{ color: "#6b7280", fontSize: "13px" }}>
                  <div>{item.email}</div>
                  <div>{item.phone}</div>
                </div>
              </MockupTd>
              <MockupTd>{item.businessType || "Indoor"}</MockupTd>
              <MockupTd>{formatCurrency(item.balance)}</MockupTd>
              <MockupTd><PaymentStatusBadge status={item.status} /></MockupTd>
              <MockupTd>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button onClick={() => openEdit(item.id)} style={{ background: "none", border: "none", color: "#1e3a8a", fontWeight: 600, cursor: "pointer", fontSize: "14px", padding: 0 }} type="button">Edit</button>
                  <button onClick={() => setDeleteId(item.id)} style={{ background: "none", border: "none", color: "#ef4444", fontWeight: 600, cursor: "pointer", fontSize: "14px", padding: 0 }} type="button">Delete</button>
                </div>
              </MockupTd>
            </MockupTr>
          ))}
        </MockupTable>
      ) : null}

      {editId && selected ? (
        <Modal onClose={() => setEditId(null)} title="Edit vendor">
          <FormGrid>
            <Field label="Full name"><Input onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} value={form.fullName} /></Field>
            <Field label="Email"><Input onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} value={form.email} /></Field>
            <Field label="Phone"><Input onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} value={form.phone} /></Field>
            <Field label="Status">
              <Select onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))} value={form.status}>
                <option>Active</option><option>Inactive</option><option>Suspended</option>
              </Select>
            </Field>
            <Field label="Business name"><Input onChange={(e) => setForm((c) => ({ ...c, businessName: e.target.value }))} value={form.businessName} /></Field>
            <Field label="Business type"><Input onChange={(e) => setForm((c) => ({ ...c, businessType: e.target.value }))} value={form.businessType} /></Field>
          </FormGrid>
          <ModalFooter>
            <Button disabled={saveVendor.isPending} onClick={() => saveVendor.mutate()}><Save className="mr-2 h-4 w-4" />Save vendor</Button>
            <Button disabled={notifyVendor.isPending} onClick={() => notifyVendor.mutate()} variant="outline"><BellRing className="mr-2 h-4 w-4" />Send notice</Button>
            <Button onClick={() => setEditId(null)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {deleteId && selectedForDelete ? (
        <ConfirmDeleteModal
          isPending={removeVendor.isPending}
          message={`This will delete ${selectedForDelete.fullName}'s vendor record and related vendor records such as applications, leases, billings, payments, and violations.`}
          onClose={() => setDeleteId(null)}
          onConfirm={() => removeVendor.mutate()}
          title="Delete vendor"
        />
      ) : null}
    </div>
  );
}

// ─── Applications ─────────────────────────────────────────────────────────────

export function AdminApplicationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.applications, queryFn: fetchApplications, enabled: isSupabaseConfigured });
  const { data: vendorOptions = [] } = useQuery({ queryKey: queryKeys.vendorOptions, queryFn: fetchVendorOptions, enabled: isSupabaseConfigured });
  const { data: stallOptions = [] } = useQuery({ queryKey: queryKeys.stallOptions, queryFn: () => fetchStallOptions(), enabled: isSupabaseConfigured });
  const [modal, setModal] = useState<"review" | "details" | "walk-in" | null>(null);
  const [reviewId, setReviewId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [assignedStallId, setAssignedStallId] = useState("");
  const [walkIn, setWalkIn] = useState({ vendorId: "", businessType: "", preferredSection: "Dry Goods", preferredStallType: "General Merchandise", remarks: "" });

  const selected = data?.rows.find((r) => r.id === reviewId);
  const { data: applicationDocuments = [], isPending: isDocumentsPending, error: documentsError } = useQuery({
    queryKey: queryKeys.applicationDocuments(reviewId),
    queryFn: () => fetchApplicationDocuments(reviewId),
    enabled: isSupabaseConfigured && (modal === "review" || modal === "details") && Boolean(reviewId),
  });

  const openReview = (id: string) => {
    const app = data?.rows.find((r) => r.id === id);
    if (!app) return;
    setReviewId(id);
    setRemarks(app.remarks);
    setRejectionReason(app.rejectionReason);
    setAssignedStallId(app.preferredStallId ?? "");
    setModal("review");
  };

  const openDetails = (id: string) => {
    const app = data?.rows.find((r) => r.id === id);
    if (!app) return;
    setReviewId(id);
    setModal("details");
  };

  const review = useMutation({
    mutationFn: async (status: "under_review" | "approved" | "needs_resubmission" | "rejected") =>
      updateApplicationReview(user!.id, { applicationId: reviewId, status, remarks, rejectionReason }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.applications }), queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })]);
      toast.success("Application review updated.");
      setModal(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const completeAssignment = useMutation({
    mutationFn: async () => completeApplicationAssignment(user!.id, { applicationId: reviewId, stallId: assignedStallId, remarks }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.applications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stalls }),
      ]);
      toast.success("Application completed and stall assigned.");
      setModal(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const verifyDocument = useMutation({
    mutationFn: async (input: { documentId: string; status: "verified" | "needs_resubmission" | "rejected" | "pending"; remarks: string }) =>
      updateDocumentVerification(user!.id, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.applicationDocuments(reviewId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applications }),
      ]);
      toast.success("Document verification updated.");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const createWalkIn = useMutation({
    mutationFn: async () => createWalkInApplication(user!.id, walkIn),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.applications }), queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })]);
      toast.success("Walk-in application created.");
      setModal(null);
      setWalkIn({ vendorId: "", businessType: "", preferredSection: "Dry Goods", preferredStallType: "General Merchandise", remarks: "" });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1e3a8a", margin: 0 }}>VENDOR APPLICATIONS</h2>

      {/* Pending Applications box */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px", maxWidth: "480px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ color: "#1e3a8a" }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" /></svg>
          </span>
          <span style={{ fontWeight: 700, color: "#1e3a8a", fontSize: "15px" }}>PENDING APPLICATIONS</span>
        </div>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 16px" }}>Review and approve new vendor applications</p>
        {isPending ? <LoadingCard message="Loading applications..." /> : null}
        {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
        {!isPending && !error && data && data.rows.filter((r) => r.status === "Pending" || r.status === "Under Review").length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "16px 0" }}>No pending applications</p>
        ) : null}
        {data?.rows.filter((r) => r.status === "Pending" || r.status === "Under Review").map((item) => (
          <div key={item.id} style={{ borderTop: "1px solid #f3f4f6", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "14px" }}>{item.vendorName}</p>
              <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>{item.businessType} · {item.updatedAt}</p>
            </div>
            <button onClick={() => openReview(item.id)} style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }} type="button">Review</button>
          </div>
        ))}
      </div>

      {/* All Applications table */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <span style={{ fontWeight: 700, color: "#1e3a8a", fontSize: "15px" }}>ALL APPLICATIONS</span>
          <div style={{ display: "flex", gap: "8px" }}>
            {["All", "Pending", "Approved", "Rejected"].map((f) => (
              <span key={f} style={{ padding: "4px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: f === "All" ? "#e5e7eb" : f === "Pending" ? "#fef9c3" : f === "Approved" ? "#dcfce7" : "#fee2e2", color: f === "All" ? "#374151" : f === "Pending" ? "#a16207" : f === "Approved" ? "#15803d" : "#dc2626" }}>{f}</span>
            ))}
          </div>
        </div>
        {data ? (
          <MockupTable head={["DATE", "APPLICANT", "BUSINESS", "CONTACT", "PREFERENCE", "STATUS", "ACTIONS"]}>
            {data.rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#9ca3af", padding: "24px", fontSize: "14px" }}>No applications yet</td></tr>
            ) : data.rows.map((item) => (
              <MockupTr key={item.id}>
                <MockupTd style={{ color: "#6b7280", fontSize: "13px" }}>{item.updatedAt}</MockupTd>
                <MockupTd style={{ fontWeight: 600 }}>{item.vendorName}</MockupTd>
                <MockupTd>{item.businessType}</MockupTd>
                <MockupTd style={{ color: "#6b7280", fontSize: "13px" }}>—</MockupTd>
                <MockupTd>{item.preferredStallLabel}</MockupTd>
                <MockupTd>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <AppStatusBadge status={item.status} />
                    {item.status === "Assigned" ? (
                      <Badge variant="success" style={{ width: "fit-content" }}>Assigned stall</Badge>
                    ) : null}
                  </div>
                </MockupTd>
                <MockupTd>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => openDetails(item.id)} style={{ background: "none", border: "none", color: "#1e3a8a", fontWeight: 600, cursor: "pointer", fontSize: "13px", padding: 0 }} type="button">View</button>
                    <button onClick={() => openReview(item.id)} style={{ background: "none", border: "none", color: "#16a34a", fontWeight: 600, cursor: "pointer", fontSize: "13px", padding: 0 }} type="button">Review</button>
                  </div>
                </MockupTd>
              </MockupTr>
            ))}
          </MockupTable>
        ) : null}
      </div>
    </div>

      {modal === "details" && selected ? (
        <Modal onClose={() => setModal(null)} size="lg" title={`Application details: ${selected.vendorName}`}>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <InfoItem label="Submitted" value={selected.submittedAt} />
            <InfoItem label="Last updated" value={selected.updatedAt} />
            <InfoItem label="Business type" value={selected.businessType} />
            <InfoItem label="Preferred section" value={selected.preferredSection} />
            <InfoItem label="Preferred stall type" value={selected.preferredStallType} />
            <InfoItem label="Preferred stall" value={selected.preferredStallLabel} />
            <InfoItem label="Status" value={selected.status} />
            <InfoItem label="Documents" value={`${selected.documentsVerified} / ${selected.documentsUploaded} verified`} />
          </div>
          <Field label="Application note">
            <p className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              {selected.remarks || "No application note provided."}
            </p>
          </Field>
          <Field label="Rejection / resubmission note">
            <p className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              {selected.rejectionReason || "No rejection or resubmission note."}
            </p>
          </Field>
          <Field label="Application documents">
            {isDocumentsPending ? (
              <p className="text-sm text-muted-foreground">Loading application documents...</p>
            ) : documentsError ? (
              <p className="text-sm text-destructive">{String(documentsError)}</p>
            ) : applicationDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded for this application yet.</p>
            ) : (
              <div className="space-y-3">
                {applicationDocuments.map((document) => (
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4" key={document.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{document.document}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Uploaded {document.uploadedAt} · Expiry {document.expiry}
                        </p>
                      </div>
                      <StatusBadge status={document.status} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {document.remarks || "No remarks provided."}
                    </p>
                    {document.fileUrl ? (
                      <div className="mt-3">
                        <Button
                          onClick={() => window.open(document.fileUrl, "_blank", "noopener,noreferrer")}
                          size="sm"
                          variant="outline"
                        >
                          View file
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Field>
          <ModalFooter>
            <Button onClick={() => setModal(null)} variant="ghost">Close</Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {modal === "review" && selected ? (
        <Modal onClose={() => setModal(null)} size="lg" title={`Review: ${selected.vendorName}`}>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <InfoItem label="Submitted" value={selected.submittedAt} />
            <InfoItem label="Last updated" value={selected.updatedAt} />
            <InfoItem label="Business type" value={selected.businessType} />
            <InfoItem label="Preferred section" value={selected.preferredSection} />
            <InfoItem label="Preferred stall type" value={selected.preferredStallType} />
            <InfoItem label="Preferred stall" value={selected.preferredStallLabel} />
            <InfoItem label="Documents" value={`${selected.documentsVerified} / ${selected.documentsUploaded} verified`} />
          </div>
          <Field label="Application note">
            <p className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              {selected.remarks || "No application note provided."}
            </p>
          </Field>
          <Field label="Application documents">
            {isDocumentsPending ? (
              <p className="text-sm text-muted-foreground">Loading application documents...</p>
            ) : documentsError ? (
              <p className="text-sm text-destructive">{String(documentsError)}</p>
            ) : applicationDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded for this application yet.</p>
            ) : (
              <div className="space-y-3">
                {applicationDocuments.map((document) => (
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4" key={document.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{document.document}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Uploaded {document.uploadedAt} · Expiry {document.expiry}
                        </p>
                      </div>
                      <StatusBadge status={document.status} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {document.remarks || "No remarks provided."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {document.fileUrl ? (
                        <Button
                          onClick={() => window.open(document.fileUrl, "_blank", "noopener,noreferrer")}
                          size="sm"
                          variant="outline"
                        >
                          View file
                        </Button>
                      ) : null}
                      <Button
                        disabled={verifyDocument.isPending}
                        onClick={() =>
                          verifyDocument.mutate({
                            documentId: document.id,
                            status: "verified",
                            remarks: document.remarks,
                          })}
                        size="sm"
                        variant="outline"
                      >
                        Verify
                      </Button>
                      <Button
                        disabled={verifyDocument.isPending}
                        onClick={() =>
                          verifyDocument.mutate({
                            documentId: document.id,
                            status: "needs_resubmission",
                            remarks: document.remarks,
                          })}
                        size="sm"
                        variant="secondary"
                      >
                        Needs resubmission
                      </Button>
                      <Button
                        disabled={verifyDocument.isPending}
                        onClick={() =>
                          verifyDocument.mutate({
                            documentId: document.id,
                            status: "rejected",
                            remarks: document.remarks,
                          })}
                        size="sm"
                        variant="destructive"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Field>
          <Field label="Remarks">
            <Textarea onChange={(e) => setRemarks(e.target.value)} rows={3} value={remarks} />
          </Field>
          <Field label="Rejection / resubmission note">
            <Textarea onChange={(e) => setRejectionReason(e.target.value)} rows={3} value={rejectionReason} />
          </Field>
          <Field label="Assign stall">
            <Select onChange={(e) => setAssignedStallId(e.target.value)} value={assignedStallId}>
              <option value="">Select a stall</option>
              {(stallOptions as AdminOption[]).map((stall) => (
                <option key={stall.value} value={stall.value}>{stall.label}</option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              Choose a stall to complete the application. This will create the lease and mark the stall as occupied.
            </p>
          </Field>
          <ModalFooter>
            <Button onClick={() => review.mutate("under_review")} variant="outline">Mark under review</Button>
            <Button onClick={() => review.mutate("approved")}><CheckCircle2 className="mr-2 h-4 w-4" />Approve</Button>
            <Button disabled={!assignedStallId || completeAssignment.isPending} onClick={() => completeAssignment.mutate()}>
              <CheckCircle2 className="mr-2 h-4 w-4" />Approve & assign
            </Button>
            <Button onClick={() => review.mutate("needs_resubmission")} variant="secondary">Needs resubmission</Button>
            <Button onClick={() => review.mutate("rejected")} variant="destructive">Reject</Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {modal === "walk-in" ? (
        <Modal onClose={() => setModal(null)} title="New walk-in application">
          <FormGrid>
            <Field label="Vendor">
              <Select onChange={(e) => setWalkIn((v) => ({ ...v, vendorId: e.target.value }))} value={walkIn.vendorId}>
                <option value="">— Select vendor —</option>
                {vendorOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </Field>
            <Field label="Business type">
              <Input onChange={(e) => setWalkIn((v) => ({ ...v, businessType: e.target.value }))} value={walkIn.businessType} />
            </Field>
            <Field label="Preferred section">
              <Select onChange={(e) => setWalkIn((v) => ({ ...v, preferredSection: e.target.value }))} value={walkIn.preferredSection}>
                <option>Dry Goods</option><option>Wet Market</option><option>Vegetables</option><option>Fish Aisle</option>
              </Select>
            </Field>
            <Field label="Preferred stall type">
              <Select onChange={(e) => setWalkIn((v) => ({ ...v, preferredStallType: e.target.value }))} value={walkIn.preferredStallType}>
                <option>General Merchandise</option><option>Fish</option><option>Meat</option><option>Produce</option>
              </Select>
            </Field>
          </FormGrid>
          <Field label="Remarks">
            <Textarea onChange={(e) => setWalkIn((v) => ({ ...v, remarks: e.target.value }))} rows={3} value={walkIn.remarks} />
          </Field>
          <ModalFooter>
            <Button disabled={!walkIn.vendorId || createWalkIn.isPending} onClick={() => createWalkIn.mutate()}>
              <Send className="mr-2 h-4 w-4" />Submit walk-in
            </Button>
            <Button onClick={() => setModal(null)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </>
  );
}

// ─── Documents ────────────────────────────────────────────────────────────────

export function AdminStallsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.stalls, queryFn: fetchStalls, enabled: isSupabaseConfigured });
  const { data: sections = [] } = useQuery({ queryKey: queryKeys.sectionOptions, queryFn: fetchSectionOptions, enabled: isSupabaseConfigured });
  const [modal, setModal] = useState<"form" | "delete" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ sectionId: "", stallNumber: "", stallType: "", monthlyRate: "0", status: "Available", notes: "" });
  const [view, setView] = useState<"map" | "list">("map");

  const openCreate = () => {
    setEditId(null);
    setForm({ sectionId: sections[0]?.value ?? "", stallNumber: "", stallType: "", monthlyRate: "0", status: "Available", notes: "" });
    setModal("form");
  };

  const openEdit = (id: string) => {
    const stall = data?.rows.find((r) => r.id === id);
    if (!stall) return;
    setEditId(id);
    setForm({ sectionId: stall.sectionId, stallNumber: stall.stallNumber, stallType: stall.type, monthlyRate: String(stall.rate), status: stall.status, notes: stall.notes });
    setModal("form");
  };

  const openDelete = (id: string) => { setEditId(id); setModal("delete"); };

  const save = useMutation({
    mutationFn: async () => saveStall(user!.id, { stallId: editId || undefined, sectionId: form.sectionId, stallNumber: form.stallNumber, stallType: form.stallType, monthlyRate: Number(form.monthlyRate), status: form.status, notes: form.notes }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.stalls }), queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })]);
      toast.success("Stall saved.");
      setModal(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async () => deleteStall(user!.id, editId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.stalls });
      toast.success("Stall deleted.");
      setModal(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1e3a8a", margin: 0 }}>GROUND FLOOR PLAN</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", border: "1px solid #d1d5db" }}>
            <button onClick={() => setView("map")} style={{ padding: "6px 14px", fontSize: "13px", fontWeight: 500, background: view === "map" ? "#1e3a8a" : "#fff", color: view === "map" ? "#fff" : "#374151", border: "none", cursor: "pointer" }} type="button">Map</button>
            <button onClick={() => setView("list")} style={{ padding: "6px 14px", fontSize: "13px", fontWeight: 500, background: view === "list" ? "#1e3a8a" : "#fff", color: view === "list" ? "#fff" : "#374151", border: "none", cursor: "pointer" }} type="button">List</button>
          </div>
          <button onClick={openCreate} style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }} type="button">+ New Stall</button>
        </div>
      </div>
      {isPending ? <LoadingCard message="Loading stalls..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
      {data ? (
        <>
          {view === "map" ? (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
              <StallHeatMap onEdit={openEdit} stalls={data.rows} />
            </div>
          ) : (
            <MockupTable head={["STALL", "TYPE", "SECTION", "MONTHLY RATE", "STATUS", "NOTES", "ACTIONS"]}>
              {data.rows.map((item) => (
                <MockupTr key={item.id}>
                  <MockupTd><span style={{ fontWeight: 600 }}>{item.stall}</span></MockupTd>
                  <MockupTd style={{ color: "#6b7280" }}>{item.type}</MockupTd>
                  <MockupTd>{item.section}</MockupTd>
                  <MockupTd>{formatCurrency(item.rate)}</MockupTd>
                  <MockupTd><StallStatusBadge status={item.status} /></MockupTd>
                  <MockupTd style={{ color: "#6b7280", maxWidth: "180px" }}>{item.notes || "—"}</MockupTd>
                  <MockupTd>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => openEdit(item.id)} style={{ background: "none", border: "none", color: "#1e3a8a", fontWeight: 600, cursor: "pointer", fontSize: "13px", padding: 0 }} type="button">Edit</button>
                      <button onClick={() => openDelete(item.id)} style={{ background: "none", border: "none", color: "#ef4444", fontWeight: 600, cursor: "pointer", fontSize: "13px", padding: 0 }} type="button">Delete</button>
                    </div>
                  </MockupTd>
                </MockupTr>
              ))}
            </MockupTable>
          )}
        </>
      ) : null}

      {modal === "form" ? (
        <Modal onClose={() => setModal(null)} title={editId ? "Edit stall" : "Create stall"}>
          <FormGrid>
            <Field label="Section">
              <Select onChange={(e) => setForm((c) => ({ ...c, sectionId: e.target.value }))} value={form.sectionId}>
                {sections.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Stall number"><Input onChange={(e) => setForm((c) => ({ ...c, stallNumber: e.target.value }))} value={form.stallNumber} /></Field>
            <Field label="Stall type">
              <Select onChange={(e) => setForm((c) => ({ ...c, stallType: e.target.value }))} value={form.stallType}>
                <option>General Merchandise</option>
                <option>Fish</option>
                <option>Meat</option>
                <option>Produce</option>
              </Select>
            </Field>
            <Field label="Monthly rate"><Input onChange={(e) => setForm((c) => ({ ...c, monthlyRate: e.target.value }))} type="number" value={form.monthlyRate} /></Field>
            <Field label="Status">
              <Select onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))} value={form.status}>
                <option>Available</option><option>Reserved</option><option>Occupied</option><option>Under Maintenance</option><option>Inactive</option>
              </Select>
            </Field>
          </FormGrid>
          <Field label="Notes"><Textarea onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} rows={3} value={form.notes} /></Field>
          <ModalFooter>
            <Button disabled={save.isPending} onClick={() => save.mutate()}><Save className="mr-2 h-4 w-4" />Save stall</Button>
            <Button onClick={() => setModal(null)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {modal === "delete" ? (
        <ConfirmDeleteModal
          isPending={remove.isPending}
          message="This action cannot be undone. The stall record will be permanently removed."
          onClose={() => setModal(null)}
          onConfirm={() => remove.mutate()}
          title="Delete stall"
        />
      ) : null}
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export function AdminBillingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.billings, queryFn: fetchBillings, enabled: isSupabaseConfigured });
  const [editId, setEditId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const { data: vendors = [] } = useQuery({ queryKey: queryKeys.vendorOptions, queryFn: fetchVendorOptions, enabled: isSupabaseConfigured });
  const { data: vendorLeaseRates = {} } = useQuery({ queryKey: ["admin-vendor-lease-rates"], queryFn: fetchVendorLeaseRates, enabled: isSupabaseConfigured });
  const [form, setForm] = useState({ vendorId: "", billingMonth: todayIso(), dueDate: todayIso(), notes: "" });

  const selected = data?.rows.find((r) => r.id === editId);

  const openCreate = () => {
    setEditId(null);
    setForm({ vendorId: "", billingMonth: todayIso(), dueDate: todayIso(), notes: "" });
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    const b = data?.rows.find((r) => r.id === id);
    if (!b) return;
    setEditId(id);
    setForm({ vendorId: b.vendorId, billingMonth: b.billingMonthIso, dueDate: b.dueDateIso, notes: b.notes });
    setShowModal(true);
  };

  const save = useMutation({
    mutationFn: async () =>
      editId
        ? updateBilling(user!.id, { billingId: editId, billingMonth: form.billingMonth, dueDate: form.dueDate, notes: form.notes })
        : createBilling(user!.id, { vendorId: form.vendorId, billingMonth: form.billingMonth, dueDate: form.dueDate, notes: form.notes }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.billings }), queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })]);
      toast.success(editId ? "Billing updated." : "Billing created.");
      setShowModal(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Button onClick={openCreate} variant="secondary"><Plus className="mr-2 h-4 w-4" />New billing</Button>}
        description="Track bill generation, balances, arrears, and collection readiness."
        eyebrow="Admin module"
        title="Billing monitor"
      />
      {isPending ? <LoadingCard message="Loading billing records..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
      {data ? (
        <>
          <SummaryGrid summary={data.summary} />
          <Tbl head={["Vendor", "Stall", "Billing month", "Amount due", "Penalties", "Due date", "Status", "Actions"]}>
            {data.rows.map((item) => (
              <Tr key={item.id}>
                <Td><span className="font-medium text-foreground">{item.vendor}</span></Td>
                <Td>{item.stall}</Td>
                <Td>{item.billingMonth}</Td>
                <Td>{formatCurrency(item.amountDue)}</Td>
                <Td>{formatCurrency(item.penalties)}</Td>
                <Td className="text-muted-foreground">{item.dueDate}</Td>
                <Td><StatusBadge status={item.status} /></Td>
                <Td>
                  <Button onClick={() => openEdit(item.id)} size="sm" variant="outline"><PencilLine className="mr-2 h-3 w-3" />Edit</Button>
                </Td>
              </Tr>
            ))}
          </Tbl>
        </>
      ) : null}

      {showModal ? (
        <Modal onClose={() => setShowModal(false)} title={editId ? "Edit billing" : "Create billing"}>
          {!editId && (
            <Field label="Vendor">
              <Select
                onChange={(e) => {
                  const vendorId = e.target.value;
                  setForm((c) => ({ ...c, vendorId }));
                }}
                value={form.vendorId}
              >
                <option value="">Select vendor</option>
                {(vendors as AdminOption[]).map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </Select>
            </Field>
          )}
          <FormGrid>
            <Field label="Billing month"><Input onChange={(e) => setForm((c) => ({ ...c, billingMonth: e.target.value }))} type="date" value={form.billingMonth} /></Field>
            <Field label="Due date"><Input onChange={(e) => setForm((c) => ({ ...c, dueDate: e.target.value }))} type="date" value={form.dueDate} /></Field>
            <Field label="Base rent"><Input disabled value={editId ? formatCurrency(selected?.baseAmount ?? 0) : formatCurrency((vendorLeaseRates as Record<string, number | null>)[form.vendorId] ?? 0)} /></Field>
            <Field label="Amount due"><Input disabled value={editId ? formatCurrency(selected?.amountDue ?? 0) : "Calculated after creation"} /></Field>
          </FormGrid>
          <Field label="Notes"><Textarea onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} rows={3} value={form.notes} /></Field>
          <ModalFooter>
            <Button disabled={save.isPending || (!editId && !form.vendorId)} onClick={() => save.mutate()}><WalletCards className="mr-2 h-4 w-4" />{editId ? "Save billing" : "Create billing"}</Button>
            <Button onClick={() => setShowModal(false)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: billingData, isPending, error } = useQuery({ queryKey: queryKeys.billings, queryFn: fetchBillings, enabled: isSupabaseConfigured });
  const { data: paymentData } = useQuery({ queryKey: queryKeys.payments, queryFn: fetchPayments, enabled: isSupabaseConfigured });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ billingId: "", amount: "0", paymentDate: todayIso(), method: "Cash", receiptNumber: "", notes: "" });

  const billingRows = billingData?.rows ?? [];
  const paymentRows = paymentData?.rows ?? [];

  const lastPaymentByBillingId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of paymentRows) {
      if (!map.has(p.billingId)) map.set(p.billingId, p.paymentDate);
    }
    return map;
  }, [paymentRows]);

  const openRecordModal = (billingId = "", remaining = 0) => {
    setForm({ billingId, amount: remaining > 0 ? String(remaining) : "0", paymentDate: todayIso(), method: "Cash", receiptNumber: "", notes: "" });
    setShowModal(true);
  };

  const save = useMutation({
    mutationFn: async () => createPayment(user!.id, { billingId: form.billingId, amount: Number(form.amount), paymentDate: form.paymentDate, method: form.method, receiptNumber: form.receiptNumber, notes: form.notes }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.payments }), queryClient.invalidateQueries({ queryKey: queryKeys.billings })]);
      toast.success("Payment recorded.");
      setShowModal(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const review = useMutation({
    mutationFn: async ({ groupId, status }: { groupId: string; status: "verified" | "rejected" }) =>
      reviewPayment(user!.id, groupId, status),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.payments }), queryClient.invalidateQueries({ queryKey: queryKeys.billings })]);
      toast.success("Payment review saved.");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const unpaidCount = billingRows.filter((r) => r.status === "Unpaid" || r.status === "Overdue").length;
  const partialCount = billingRows.filter((r) => r.status === "Partial").length;
  const totalOutstanding = billingRows.reduce((sum, r) => sum + Math.max(r.amountDue - r.amountPaid, 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1e3a8a", margin: 0 }}>PAYMENT MONITORING</h2>
        <Button onClick={() => openRecordModal()}><WalletCards className="mr-2 h-4 w-4" />Record Payment</Button>
      </div>

      {billingRows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          <PaymentSummaryCard label="Total Outstanding" value={formatCurrency(totalOutstanding)} color="#dc2626" />
          <PaymentSummaryCard label="Unpaid / Overdue" value={String(unpaidCount)} color="#b45309" />
          <PaymentSummaryCard label="Partial Payments" value={String(partialCount)} color="#1d4ed8" />
        </div>
      )}

      {paymentRows.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">Payment records and submissions</h3>
          <Tbl head={["Reference", "Vendor", "Date", "Amount", "Method", "Status", "Proof", "Review"]}>
            {paymentRows.map((item) => (
              <Tr key={item.id}>
                <Td>{item.internalReference}</Td>
                <Td>{item.vendor}</Td>
                <Td>{item.paymentDate}</Td>
                <Td>{formatCurrency(item.amount)}</Td>
                <Td>{item.method}{item.receipt !== "-" ? ` · ${item.receipt}` : ""}</Td>
                <Td><StatusBadge status={item.verificationStatus} /></Td>
                <Td>{item.proofUrl ? <a className="inline-flex items-center gap-1 text-primary underline" href={item.proofUrl} rel="noreferrer" target="_blank">View <ExternalLink className="h-3 w-3" /></a> : "—"}</Td>
                <Td>
                  {item.verificationStatus === "Pending" ? (
                    <div className="flex gap-2">
                      <Button disabled={review.isPending} onClick={() => review.mutate({ groupId: item.paymentGroupId, status: "verified" })} size="sm">Verify</Button>
                      <Button disabled={review.isPending} onClick={() => review.mutate({ groupId: item.paymentGroupId, status: "rejected" })} size="sm" variant="destructive">Reject</Button>
                    </div>
                  ) : "—"}
                </Td>
              </Tr>
            ))}
          </Tbl>
        </div>
      ) : null}

      {isPending ? <LoadingCard message="Loading payment records..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}

      {!isPending && !error && billingRows.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <p style={{ fontSize: "16px", fontWeight: 600 }}>No billing records found</p>
          <p style={{ fontSize: "13px", marginTop: 4 }}>Create billing records first to monitor payments.</p>
        </div>
      )}

      {billingRows.length > 0 && (
        <MockupTable head={["STALL #", "VENDOR", "AMOUNT DUE", "LAST PAYMENT", "DUE DATE", "STATUS", "ACTIONS"]}>
          {billingRows.map((item) => {
            const remaining = Math.max(item.amountDue - item.amountPaid, 0);
            const lastPaid = lastPaymentByBillingId.get(item.id) ?? "—";
            const isPaidOff = item.status === "Paid";
            return (
              <MockupTr key={item.id}>
                <MockupTd><span style={{ fontWeight: 600 }}>{item.stall}</span></MockupTd>
                <MockupTd>{item.vendor}</MockupTd>
                <MockupTd style={{ fontWeight: 600 }}>
                  {formatCurrency(item.amountDue)}
                  {item.amountPaid > 0 && !isPaidOff && (
                    <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: 6 }}>(₱{remaining.toLocaleString()} left)</span>
                  )}
                </MockupTd>
                <MockupTd style={{ color: "#6b7280" }}>{lastPaid}</MockupTd>
                <MockupTd style={{ color: item.status === "Overdue" ? "#dc2626" : "#6b7280" }}>{item.dueDate}</MockupTd>
                <MockupTd><PaymentStatusBadge status={item.status} /></MockupTd>
                <MockupTd>
                  {!isPaidOff ? (
                    <button
                      onClick={() => openRecordModal(item.id, remaining)}
                      style={{ background: "none", border: "none", color: "#16a34a", fontWeight: 600, cursor: "pointer", fontSize: "14px", padding: 0 }}
                      type="button"
                    >
                      Mark Paid
                    </button>
                  ) : (
                    <span style={{ color: "#9ca3af", fontSize: "13px" }}>Paid</span>
                  )}
                </MockupTd>
              </MockupTr>
            );
          })}
        </MockupTable>
      )}

      {showModal ? (
        <Modal onClose={() => setShowModal(false)} title="Record Payment">
          <Field label="Billing record">
            <Select onChange={(e) => {
              const selected = billingRows.find((r) => r.id === e.target.value);
              const rem = selected ? Math.max(selected.amountDue - selected.amountPaid, 0) : 0;
              setForm((c) => ({ ...c, billingId: e.target.value, amount: rem > 0 ? String(rem) : c.amount }));
            }} value={form.billingId}>
              <option value="">Select billing</option>
              {billingRows.filter((r) => r.status !== "Paid").map((item) => (
                <option key={item.id} value={item.id}>{item.vendor} — {item.stall} — {item.billingMonth}</option>
              ))}
            </Select>
          </Field>
          <FormGrid>
            <Field label="Amount"><Input onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} type="number" value={form.amount} /></Field>
            <Field label="Payment date"><Input onChange={(e) => setForm((c) => ({ ...c, paymentDate: e.target.value }))} type="date" value={form.paymentDate} /></Field>
            <Field label="Method">
              <Select onChange={(e) => setForm((c) => ({ ...c, method: e.target.value }))} value={form.method}>
                <option>Cash</option><option>GCash</option><option>Bank Transfer</option>
              </Select>
            </Field>
            <Field label="Receipt #"><Input onChange={(e) => setForm((c) => ({ ...c, receiptNumber: e.target.value }))} value={form.receiptNumber} /></Field>
          </FormGrid>
          <Field label="Notes"><Textarea onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} rows={3} value={form.notes} /></Field>
          <ModalFooter>
            <Button disabled={!form.billingId || !form.amount || Number(form.amount) <= 0 || (form.method === "GCash" && !form.receiptNumber.trim()) || save.isPending} onClick={() => save.mutate()}>
              <WalletCards className="mr-2 h-4 w-4" />Record Payment
            </Button>
            <Button onClick={() => setShowModal(false)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Violations ───────────────────────────────────────────────────────────────

export function AdminViolationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.violations, queryFn: fetchViolations, enabled: isSupabaseConfigured });
  const { data: vendors = [] } = useQuery({ queryKey: queryKeys.vendorOptions, queryFn: fetchVendorOptions, enabled: isSupabaseConfigured });
  const { data: stalls = [] } = useQuery<AdminOption[]>({ queryKey: queryKeys.stallOptions, queryFn: () => fetchStallOptions(), enabled: isSupabaseConfigured });
  const [modal, setModal] = useState<"form" | "delete" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ vendorId: "", stallId: "", category: "", description: "", violationDate: todayIso(), penaltyAmount: "0", actionTaken: "", status: "Open" });

  const openCreate = () => {
    setEditId(null);
    setForm({ vendorId: "", stallId: "", category: "", description: "", violationDate: todayIso(), penaltyAmount: "0", actionTaken: "", status: "Open" });
    setModal("form");
  };

  const openEdit = (id: string) => {
    const v = data?.rows.find((r) => r.id === id);
    if (!v) return;
    setEditId(id);
    setForm({ vendorId: v.vendorId, stallId: v.stallId ?? "", category: v.category, description: v.description, violationDate: v.dateIso, penaltyAmount: String(v.penalty), actionTaken: v.action, status: v.status });
    setModal("form");
  };

  const openDelete = (id: string) => { setEditId(id); setModal("delete"); };

  const save = useMutation({
    mutationFn: async () => saveViolation(user!.id, { violationId: editId || undefined, vendorId: form.vendorId, stallId: form.stallId || undefined, category: form.category, description: form.description, violationDate: form.violationDate, penaltyAmount: Number(form.penaltyAmount), actionTaken: form.actionTaken, status: form.status }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.violations }), queryClient.invalidateQueries({ queryKey: queryKeys.billings })]);
      toast.success(editId ? "Violation updated." : "Violation recorded.");
      setModal(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async () => deleteViolation(user!.id, editId!),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.violations }), queryClient.invalidateQueries({ queryKey: queryKeys.billings })]);
      toast.success("Violation deleted.");
      setModal(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Button onClick={openCreate} variant="secondary"><ShieldAlert className="mr-2 h-4 w-4" />New violation</Button>}
        description="Log compliance incidents and manage penalties and action taken."
        eyebrow="Admin module"
        title="Violation tracking"
      />
      {isPending ? <LoadingCard message="Loading violations..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
      {data ? (
        <>
          <SummaryGrid summary={data.summary} />
          <Tbl head={["Vendor", "Category", "Date", "Penalty", "Status", "Actions"]}>
            {data.rows.map((item) => (
              <Tr key={item.id}>
                <Td><span className="font-medium text-foreground">{item.vendor}</span></Td>
                <Td>{item.category}</Td>
                <Td className="text-muted-foreground">{item.date}</Td>
                <Td>{formatCurrency(item.penalty)}</Td>
                <Td><StatusBadge status={item.status} /></Td>
                <Td>
                  <div className="flex gap-2">
                    <Button onClick={() => openEdit(item.id)} size="sm" variant="outline"><PencilLine className="mr-2 h-3 w-3" />Edit</Button>
                    <Button onClick={() => openDelete(item.id)} size="sm" variant="destructive"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbl>
        </>
      ) : null}

      {modal === "form" ? (
        <Modal onClose={() => setModal(null)} size="lg" title={editId ? "Edit violation" : "Record violation"}>
          <FormGrid>
            <Field label="Vendor">
              <Select onChange={(e) => setForm((c) => ({ ...c, vendorId: e.target.value }))} value={form.vendorId}>
                <option value="">Select vendor</option>
                {vendors.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </Select>
            </Field>
            <Field label="Stall (optional)">
              <Select onChange={(e) => setForm((c) => ({ ...c, stallId: e.target.value }))} value={form.stallId}>
                <option value="">Optional stall</option>
                {stalls.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Category"><Input onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} value={form.category} /></Field>
            <Field label="Date"><Input onChange={(e) => setForm((c) => ({ ...c, violationDate: e.target.value }))} type="date" value={form.violationDate} /></Field>
            <Field label="Penalty"><Input onChange={(e) => setForm((c) => ({ ...c, penaltyAmount: e.target.value }))} type="number" value={form.penaltyAmount} /></Field>
            <Field label="Status">
              <Select onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))} value={form.status}>
                <option>Open</option><option>Under Review</option><option>Resolved</option>
              </Select>
            </Field>
          </FormGrid>
          <Field label="Description"><Textarea onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} rows={3} value={form.description} /></Field>
          <Field label="Action taken"><Textarea onChange={(e) => setForm((c) => ({ ...c, actionTaken: e.target.value }))} rows={3} value={form.actionTaken} /></Field>
          <ModalFooter>
            <Button disabled={save.isPending} onClick={() => save.mutate()}><Save className="mr-2 h-4 w-4" />Save violation</Button>
            <Button onClick={() => setModal(null)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {modal === "delete" ? (
        <ConfirmDeleteModal
          isPending={remove.isPending}
          message="This action cannot be undone. The violation record will be permanently removed."
          onClose={() => setModal(null)}
          onConfirm={() => remove.mutate()}
          title="Delete violation"
        />
      ) : null}
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function AdminReportsPage() {
  const [filters, setFilters] = useState<ReportFiltersInput>(defaultReportFilters);
  const { data: stalls } = useQuery({ queryKey: queryKeys.stalls, queryFn: fetchStalls, enabled: isSupabaseConfigured });
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin-reports", filters],
    queryFn: () => fetchReports(filters),
    enabled: isSupabaseConfigured,
  });

  const sectionNames = useMemo(
    () => [...new Set((stalls?.rows ?? []).map((item: AdminStallRecord) => item.section))],
    [stalls?.rows],
  );

  const exportCsv = () => {
    if (!data) return;
    const headers = Object.keys(data.rows[0] ?? {});
    const csv = [headers.join(","), ...data.rows.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "market-report.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1e3a8a", margin: 0 }}>REPORTS &amp; ANALYTICS</h2>

      <ReportFilters onChange={(field, value) => setFilters((c) => ({ ...c, [field]: value }))} onGenerate={() => void refetch()} sections={sectionNames} values={filters} />

      {isPending ? <LoadingCard message="Loading reports..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
      {data ? (
        <>
          {/* Stall Occupancy Overview card */}
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
            <p style={{ fontWeight: 700, color: "#111827", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 0, marginBottom: "16px" }}>STALL OCCUPANCY OVERVIEW</p>
            <div style={{ height: "200px", marginBottom: "16px" }}>
              <Bar
                data={{
                  labels: sectionNames.filter((s) => s !== "All sections"),
                  datasets: [{ label: "Stalls", data: sectionNames.filter((s) => s !== "All sections").map(() => Math.floor(Math.random() * 50 + 10)), backgroundColor: "#1e3a8a", borderRadius: 4 }],
                }}
                options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, responsive: true }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
              {data.summary.slice(0, 3).map((item) => (
                <div key={item.label} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px", marginTop: 0 }}>{item.label.toUpperCase()}</p>
                  <p style={{ fontSize: "28px", fontWeight: 700, color: item.label.toLowerCase().includes("vacant") ? "#374151" : item.label.toLowerCase().includes("maint") ? "#d97706" : "#16a34a", margin: 0 }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Summary + Stall Type Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
              <p style={{ fontWeight: 700, color: "#111827", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 0, marginBottom: "16px" }}>REVENUE SUMMARY</p>
              {data.summary.map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: "14px", color: "#374151" }}>{item.label}:</span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: item.label.toLowerCase().includes("outstanding") || item.label.toLowerCase().includes("overdue") ? "#ef4444" : "#16a34a" }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
              <p style={{ fontWeight: 700, color: "#111827", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 0, marginBottom: "16px" }}>STALL TYPE BREAKDOWN</p>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}><span style={{ fontSize: "14px", color: "#374151" }}>Indoor Stalls:</span><span style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a8a" }}>—</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}><span style={{ fontSize: "14px", color: "#374151" }}>Outdoor Stalls:</span><span style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a8a" }}>—</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}><span style={{ fontSize: "14px", color: "#374151" }}>Kiosks:</span><span style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a8a" }}>—</span></div>
            </div>
          </div>

          <Tbl head={["Reference", "Date", "Billing month", "Vendor", "Block", "Stall", "Amount", "Method", "External ref.", "Status"]}>
            {data.rows.map((row) => (
              <Tr key={`${row.payment_reference}-${row.billing_month}`}>
                <Td>{row.payment_reference}</Td><Td>{row.payment_date}</Td><Td>{row.billing_month}</Td>
                <Td>{row.vendor}</Td><Td>{row.block}</Td><Td>{row.stall}</Td><Td>{row.amount}</Td>
                <Td>{row.method}</Td><Td>{row.external_reference}</Td><Td><StatusBadge status={row.verification_status} /></Td>
              </Tr>
            ))}
          </Tbl>
          {data.rows.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No payment records match these filters.</p> : null}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button onClick={exportCsv} style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: "6px" }} type="button">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={() => window.print()} style={{ background: "#1e3a8a", border: "none", borderRadius: "8px", padding: "8px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }} type="button">
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.notifications, queryFn: fetchNotifications, enabled: isSupabaseConfigured });
  const { data: users = [] } = useQuery({ queryKey: queryKeys.userOptions, queryFn: fetchUserOptions, enabled: isSupabaseConfigured });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ userId: "", title: "", message: "", type: "info", link: "" });

  const save = useMutation({
    mutationFn: async () => createAdminNotification(user!.id, form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      toast.success("Notification sent.");
      setShowModal(false);
      setForm({ userId: "", title: "", message: "", type: "info", link: "" });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Button onClick={() => setShowModal(true)} variant="secondary"><Send className="mr-2 h-4 w-4" />Create notification</Button>}
        description="Create and manage in-app notification events for all user accounts."
        eyebrow="Notifications"
        title="Notification center"
      />
      {isPending ? <LoadingCard message="Loading notifications..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
      <Tbl head={["Recipient", "Title", "Message", "Status", "Actions"]}>
        {(data ?? []).map((item) => (
          <Tr key={item.id}>
            <Td><span className="font-medium text-foreground">{item.recipient}</span></Td>
            <Td>{item.title}</Td>
            <Td className="max-w-[260px] truncate text-muted-foreground">{item.message}</Td>
            <Td>{!item.isRead ? <Badge variant="warning">Unread</Badge> : <Badge variant="outline">Read</Badge>}</Td>
            <Td>
              <div className="flex gap-2">
                <Button
                  onClick={async () => { await toggleAdminNotificationRead(item.id, !item.isRead); await queryClient.invalidateQueries({ queryKey: queryKeys.notifications }); }}
                  size="sm"
                  variant="outline"
                >
                  {item.isRead ? "Mark unread" : "Mark read"}
                </Button>
                <Button
                  onClick={async () => { await deleteAdminNotification(item.id); await queryClient.invalidateQueries({ queryKey: queryKeys.notifications }); }}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Td>
          </Tr>
        ))}
      </Tbl>

      {showModal ? (
        <Modal onClose={() => setShowModal(false)} title="Create notification">
          <Field label="Recipient">
            <Select onChange={(e) => setForm((c) => ({ ...c, userId: e.target.value }))} value={form.userId}>
              <option value="">Select user</option>
              {users.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </Select>
          </Field>
          <Field label="Title"><Input onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} value={form.title} /></Field>
          <Field label="Message"><Textarea onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))} rows={4} value={form.message} /></Field>
          <FormGrid>
            <Field label="Type"><Input onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))} value={form.type} /></Field>
            <Field label="Link"><Input onChange={(e) => setForm((c) => ({ ...c, link: e.target.value }))} value={form.link} /></Field>
          </FormGrid>
          <ModalFooter>
            <Button disabled={!form.userId || save.isPending} onClick={() => save.mutate()}><Send className="mr-2 h-4 w-4" />Send notification</Button>
            <Button onClick={() => setShowModal(false)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export function AdminStaffPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.staff, queryFn: fetchStaff, enabled: isSupabaseConfigured });
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ role: "Admin", positionTitle: "", isActive: true });

  const selected = data?.rows.find((r) => r.id === editId);

  const openEdit = (id: string) => {
    const s = data?.rows.find((r) => r.id === id);
    if (!s) return;
    setEditId(id);
    setForm({ role: s.role, positionTitle: s.positionTitle, isActive: s.isActive });
  };

  const save = useMutation({
    mutationFn: async () => updateStaffRecord(user!.id, { staffId: selected!.id, profileId: selected!.profileId, role: form.role, positionTitle: form.positionTitle, isActive: form.isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.staff });
      toast.success("Staff record updated.");
      setEditId(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader description="Manage existing LGU staff records and route-level roles." eyebrow="Admin module" title="Staff management" />
      {isPending ? <LoadingCard message="Loading staff..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
      {data ? (
        <>
          <SummaryGrid summary={data.summary} />
          <Tbl head={["Name", "Email", "Role", "Position", "Status", "Actions"]}>
            {data.rows.map((item) => (
              <Tr key={item.id}>
                <Td><span className="font-medium text-foreground">{item.name}</span></Td>
                <Td className="text-muted-foreground">{item.email}</Td>
                <Td>{item.role}</Td>
                <Td className="text-muted-foreground">{item.positionTitle || "—"}</Td>
                <Td><StatusBadge status={item.isActive ? "Active" : "Inactive"} /></Td>
                <Td>
                  <Button onClick={() => openEdit(item.id)} size="sm" variant="outline"><PencilLine className="mr-2 h-3 w-3" />Edit</Button>
                </Td>
              </Tr>
            ))}
          </Tbl>
        </>
      ) : null}

      {editId && selected ? (
        <Modal onClose={() => setEditId(null)} title={`Edit staff — ${selected.name}`}>
          <Field label="Role">
            <Select onChange={(e) => setForm((c) => ({ ...c, role: e.target.value }))} value={form.role}>
              <option>Super Admin</option><option>Admin</option><option>Finance</option>
            </Select>
          </Field>
          <Field label="Position title"><Input onChange={(e) => setForm((c) => ({ ...c, positionTitle: e.target.value }))} value={form.positionTitle} /></Field>
          <Field label="Account status">
            <Select onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.value === "Active" }))} value={form.isActive ? "Active" : "Inactive"}>
              <option>Active</option><option>Inactive</option>
            </Select>
          </Field>
          <ModalFooter>
            <Button disabled={save.isPending} onClick={() => save.mutate()}><Save className="mr-2 h-4 w-4" />Save staff</Button>
            <Button onClick={() => setEditId(null)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.settings, queryFn: fetchSettings, enabled: isSupabaseConfigured });
  const [billing, setBilling] = useState({ billingDay: "5", penaltyAmount: "150", reminderDaysBefore: "3" });
  const [templates, setTemplates] = useState({ approval: "", rejection: "", overdue: "" });
  const [paymentMethods, setPaymentMethods] = useState("Cash, GCash");
  const [pickup, setPickup] = useState({ enabled: false, schedule: "", location: "", contact: "", instructions: "" });
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({ name: "", description: "", isRequired: true, hasExpiry: true, sortOrder: "0" });

  useEffect(() => {
    if (!data) return;
    setBilling({ billingDay: String(data.billingSettings.billingDay), penaltyAmount: String(data.billingSettings.penaltyAmount), reminderDaysBefore: String(data.billingSettings.reminderDaysBefore) });
    setTemplates(data.notificationTemplates);
    setPaymentMethods(data.paymentMethods.join(", "));
    setPickup(data.pickupInformation);
  }, [data]);

  const openDocEdit = (id: string) => {
    const doc = data?.documentRequirements.find((d) => d.id === id);
    if (!doc) return;
    setEditDocId(id);
    setDocForm({ name: doc.name, description: doc.description, isRequired: doc.isRequired, hasExpiry: doc.hasExpiry, sortOrder: String(doc.sortOrder) });
  };

  const saveDoc = async () => {
    if (!editDocId) return;
    await saveDocumentRequirement(user!.id, { id: editDocId, name: docForm.name, description: docForm.description, isRequired: docForm.isRequired, hasExpiry: docForm.hasExpiry, sortOrder: Number(docForm.sortOrder) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    toast.success(`${docForm.name} updated.`);
    setEditDocId(null);
  };

  const saveBilling = useMutation({
    mutationFn: async () => saveSystemSetting(user!.id, "billing_schedule", { billingDay: Number(billing.billingDay), penaltyAmount: Number(billing.penaltyAmount), reminderDaysBefore: Number(billing.reminderDaysBefore) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.settings }); toast.success("Billing schedule saved."); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveTemplates = useMutation({
    mutationFn: async () => saveSystemSetting(user!.id, "notification_templates", templates),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.settings }); toast.success("Notification templates saved."); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveOperations = useMutation({
    mutationFn: async () => Promise.all([
      saveSystemSetting(user!.id, "payment_methods", { methods: paymentMethods.split(",").map((item) => item.trim()).filter(Boolean) }),
      saveSystemSetting(user!.id, "pickup_information", pickup),
    ]),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.settings }); toast.success("Payment and pickup settings saved."); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader description="Configure document requirements, billing cadence, and notification templates." eyebrow="Configuration" title="System settings" />
      {isPending ? <LoadingCard message="Loading settings..." /> : null}
      {error ? <ErrorCard message={getErrorMessage(error)} /> : null}
      {data ? (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Document requirements</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Tbl head={["Document name", "Required", "Has expiry", "Sort order", "Actions"]}>
                {data.documentRequirements.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </Td>
                    <Td><Badge variant={item.isRequired ? "success" : "outline"}>{item.isRequired ? "Required" : "Optional"}</Badge></Td>
                    <Td><Badge variant={item.hasExpiry ? "warning" : "outline"}>{item.hasExpiry ? "Yes" : "No"}</Badge></Td>
                    <Td className="text-muted-foreground">{item.sortOrder}</Td>
                    <Td>
                      <Button onClick={() => openDocEdit(item.id)} size="sm" variant="outline"><PencilLine className="mr-2 h-3 w-3" />Edit</Button>
                    </Td>
                  </Tr>
                ))}
              </Tbl>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader><CardTitle>Billing schedules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormGrid>
                  <Field label="Billing day"><Input onChange={(e) => setBilling((c) => ({ ...c, billingDay: e.target.value }))} type="number" value={billing.billingDay} /></Field>
                  <Field label="Penalty amount"><Input onChange={(e) => setBilling((c) => ({ ...c, penaltyAmount: e.target.value }))} type="number" value={billing.penaltyAmount} /></Field>
                  <Field label="Reminder lead days"><Input onChange={(e) => setBilling((c) => ({ ...c, reminderDaysBefore: e.target.value }))} type="number" value={billing.reminderDaysBefore} /></Field>
                </FormGrid>
                <Button onClick={() => saveBilling.mutate()}><Save className="mr-2 h-4 w-4" />Save billing settings</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Notification templates</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Approval template"><Textarea onChange={(e) => setTemplates((c) => ({ ...c, approval: e.target.value }))} rows={3} value={templates.approval} /></Field>
                <Field label="Rejection template"><Textarea onChange={(e) => setTemplates((c) => ({ ...c, rejection: e.target.value }))} rows={3} value={templates.rejection} /></Field>
                <Field label="Overdue template"><Textarea onChange={(e) => setTemplates((c) => ({ ...c, overdue: e.target.value }))} rows={3} value={templates.overdue} /></Field>
                <Button onClick={() => saveTemplates.mutate()}><Save className="mr-2 h-4 w-4" />Save templates</Button>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Market, stall, payment, and pickup configuration</CardTitle>
              <CardDescription>Blocks and stalls use the shared market inventory. Configure operational payment and pickup information here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <a className="inline-flex rounded-md border px-4 py-2 text-sm font-medium text-primary hover:bg-muted" href="/admin/stalls">Manage market blocks, stall categories, numbers, rates, and assignments</a>
              <Field label="Payment methods (comma separated)"><Input onChange={(e) => setPaymentMethods(e.target.value)} value={paymentMethods} /></Field>
              <Field label="Pickup enabled">
                <Select onChange={(e) => setPickup((current) => ({ ...current, enabled: e.target.value === "Yes" }))} value={pickup.enabled ? "Yes" : "No"}><option>Yes</option><option>No</option></Select>
              </Field>
              <FormGrid>
                <Field label="Pickup schedule"><Input onChange={(e) => setPickup((current) => ({ ...current, schedule: e.target.value }))} value={pickup.schedule} /></Field>
                <Field label="Pickup location"><Input onChange={(e) => setPickup((current) => ({ ...current, location: e.target.value }))} value={pickup.location} /></Field>
                <Field label="Pickup contact"><Input onChange={(e) => setPickup((current) => ({ ...current, contact: e.target.value }))} value={pickup.contact} /></Field>
              </FormGrid>
              <Field label="Pickup instructions"><Textarea onChange={(e) => setPickup((current) => ({ ...current, instructions: e.target.value }))} rows={3} value={pickup.instructions} /></Field>
              <Button disabled={saveOperations.isPending} onClick={() => saveOperations.mutate()}><Save className="mr-2 h-4 w-4" />Save operational settings</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {editDocId ? (
        <Modal onClose={() => setEditDocId(null)} title="Edit document requirement">
          <FormGrid>
            <Field label="Name"><Input onChange={(e) => setDocForm((c) => ({ ...c, name: e.target.value }))} value={docForm.name} /></Field>
            <Field label="Sort order"><Input onChange={(e) => setDocForm((c) => ({ ...c, sortOrder: e.target.value }))} type="number" value={docForm.sortOrder} /></Field>
            <Field label="Required">
              <Select onChange={(e) => setDocForm((c) => ({ ...c, isRequired: e.target.value === "Yes" }))} value={docForm.isRequired ? "Yes" : "No"}>
                <option>Yes</option><option>No</option>
              </Select>
            </Field>
            <Field label="Has expiry">
              <Select onChange={(e) => setDocForm((c) => ({ ...c, hasExpiry: e.target.value === "Yes" }))} value={docForm.hasExpiry ? "Yes" : "No"}>
                <option>Yes</option><option>No</option>
              </Select>
            </Field>
          </FormGrid>
          <Field label="Description"><Textarea onChange={(e) => setDocForm((c) => ({ ...c, description: e.target.value }))} rows={3} value={docForm.description} /></Field>
          <ModalFooter>
            <Button onClick={saveDoc}><Save className="mr-2 h-4 w-4" />Save requirement</Button>
            <Button onClick={() => setEditDocId(null)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  size = "default",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "default" | "lg";
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", handler); };
  }, [onClose]);

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <button aria-label="Close" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} type="button" />
      <div className={`relative z-10 w-full ${size === "lg" ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-border bg-background shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-6">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  title,
  message,
  onConfirm,
  onClose,
  isPending,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <Modal onClose={onClose} title={title}>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-3 pt-2">
        <Button onClick={onClose} variant="outline">Cancel</Button>
        <Button disabled={isPending} onClick={onConfirm} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />{isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}

function Tbl({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-border/80 text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              {head.map((h) => (
                <th className="px-6 py-4 font-semibold" key={h} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">{children}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition hover:bg-muted/30">{children}</tr>;
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-6 py-4 text-foreground ${className ?? ""}`}>{children}</td>;
}

function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3 border-t border-border pt-4">{children}</div>;
}

function SummaryGrid({ summary }: { summary: [string, string][] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {summary.map(([label, value]) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <CardTitle className="text-3xl">{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function ActivityCard({ item }: { item: { title: string; detail: string; status: string; timestamp: string } }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">{item.title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-primary">{item.status}</span>
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.timestamp}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    ["Active", "Approved", "Assigned", "Paid", "Verified", "Ready", "Resolved", "Cash", "GCash", "Bank Transfer"].includes(status)
      ? "success"
      : ["Pending", "Partial", "Unpaid", "Under Review", "Needs Resubmission", "Reserved", "In Progress", "Info"].includes(status)
        ? "warning"
        : ["Rejected", "Overdue", "Inactive", "Suspended", "Expired", "Terminated"].includes(status)
          ? "destructive"
          : "outline";

  return <Badge variant={variant}>{status}</Badge>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-medium leading-7 text-foreground">{value}</p>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">{children}</div>
      </CardContent>
    </Card>
  );
}

function LoadingCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-destructive">{message}</CardContent>
    </Card>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : "";
    const details = typeof record.details === "string" ? record.details : "";
    const hint = typeof record.hint === "string" ? record.hint : "";
    const parts = [message, details, hint].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }
  return "Something went wrong. Please try again.";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Mockup-styled table helpers ──────────────────────────────────────────────

function MockupTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: "11px", color: "#6b7280", letterSpacing: "0.07em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function MockupTr({ children }: { children: ReactNode }) {
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6", transition: "background 0.1s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#f9fafb"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
    >
      {children}
    </tr>
  );
}

function MockupTd({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "14px 16px", color: "#374151", verticalAlign: "middle", ...style }}>
      {children}
    </td>
  );
}

function PaymentSummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "16px 20px" }}>
      <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: "22px", fontWeight: 700, color, margin: 0 }}>{value}</p>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const isPaid = ["Paid", "Active", "Approved", "Cash", "GCash", "Bank Transfer"].includes(status);
  const isUnpaid = ["Unpaid", "Overdue", "Inactive", "Suspended", "Rejected"].includes(status);
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      background: isPaid ? "#dcfce7" : isUnpaid ? "#fee2e2" : "#fef9c3",
      color: isPaid ? "#15803d" : isUnpaid ? "#dc2626" : "#a16207",
    }}>
      {status}
    </span>
  );
}

function AppStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    "Approved": { bg: "#dcfce7", color: "#15803d" },
    "Rejected": { bg: "#fee2e2", color: "#dc2626" },
    "Pending": { bg: "#fef9c3", color: "#a16207" },
    "Under Review": { bg: "#dbeafe", color: "#1d4ed8" },
    "Needs Resubmission": { bg: "#ffedd5", color: "#c2410c" },
  };
  const c = colors[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function StallStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    "Available": { bg: "#dcfce7", color: "#15803d" },
    "Occupied": { bg: "#fee2e2", color: "#dc2626" },
    "Under Maintenance": { bg: "#fef9c3", color: "#a16207" },
    "Reserved": { bg: "#dbeafe", color: "#1d4ed8" },
    "Inactive": { bg: "#f3f4f6", color: "#6b7280" },
  };
  const c = colors[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}
