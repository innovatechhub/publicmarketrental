import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  createAdminNotification,
  createAssignment,
  createBilling,
  createPayment,
  createWalkInApplication,
  deleteStall,
  fetchAdminDashboardSnapshot,
  fetchApplicationDocuments,
  fetchApplications,
  fetchAssignments,
  fetchBillings,
  fetchLeaseOptions,
  fetchLeases,
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
  fetchVendorRegistry,
  fetchViolations,
  saveDocumentRequirement,
  saveStall,
  saveSystemSetting,
  saveViolation,
  toggleAdminNotificationRead,
  updateApplicationReview,
  updateBilling,
  updateDocumentVerification,
  updateLease,
  updateStaffRecord,
  updateVendorRecord,
  type AdminOption,
  type AdminStallRecord,
  type ReportFiltersInput,
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
  assignments: ["admin-assignments"],
  leases: ["admin-leases"],
  billings: ["admin-billings"],
  payments: ["admin-payments"],
  violations: ["admin-violations"],
  notifications: ["admin-notifications"],
  staff: ["admin-staff"],
  settings: ["admin-settings"],
  sectionOptions: ["admin-section-options"],
  userOptions: ["admin-user-options"],
  vendorOptions: ["admin-vendor-options"],
  stallOptions: ["admin-stall-options"],
  leaseOptions: ["admin-lease-options"],
} as const;

const defaultReportFilters: ReportFiltersInput = {
  dateFrom: "2026-03-01",
  dateTo: "2026-03-22",
  section: "All sections",
  paymentStatus: "Any status",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: fetchAdminDashboardSnapshot,
    enabled: isSupabaseConfigured,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button variant="secondary">
            <Activity className="mr-2 h-4 w-4" />
            Live operations snapshot
          </Button>
        }
        description="Monitor occupancy, applications, payments, and compliance across the Culasi public market in one operational workspace."
        eyebrow="Admin portal"
        title="Market operations dashboard"
      />

      {isPending ? <LoadingCard message="Loading admin dashboard..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}

      {!isPending && !error && data ? (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            {data.metrics.map((metric) => (
              <StatCard key={metric.label} metric={metric} />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <ChartCard description="Occupied versus available stalls by market section" title="Occupancy by section">
              <Bar
                data={{
                  labels: data.occupancyBySection.map((item) => item.section),
                  datasets: [
                    { label: "Occupied", data: data.occupancyBySection.map((item) => item.occupied), backgroundColor: "#0f766e", borderRadius: 999 },
                    { label: "Available", data: data.occupancyBySection.map((item) => item.available), backgroundColor: "#f59e0b", borderRadius: 999 },
                  ],
                }}
                options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, responsive: true }}
              />
            </ChartCard>

            <ChartCard description="Collection performance by month" title="Monthly payment collections">
              <Line
                data={{
                  labels: data.monthlyCollections.map((item) => item.month),
                  datasets: [
                    { label: "Collected", data: data.monthlyCollections.map((item) => item.collected), borderColor: "#0f766e", backgroundColor: "rgba(15,118,110,0.16)", tension: 0.35 },
                    { label: "Target", data: data.monthlyCollections.map((item) => item.target), borderColor: "#d97706", backgroundColor: "rgba(217,119,6,0.12)", tension: 0.35 },
                  ],
                }}
                options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, responsive: true }}
              />
            </ChartCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <ChartCard description="Application state distribution across the current queue" title="Application pipeline">
              <Doughnut
                data={{
                  labels: data.applicationStatusBreakdown.map((item) => item.label),
                  datasets: [{ data: data.applicationStatusBreakdown.map((item) => item.value), backgroundColor: data.applicationStatusBreakdown.map((item) => item.color), borderWidth: 0 }],
                }}
                options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
              />
            </ChartCard>

            <Card>
              <CardHeader>
                <CardTitle>Recent activity feed</CardTitle>
                <CardDescription>Key actions that changed occupancy, payment, or compliance status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.activities.map((item) => (
                  <ActivityCard item={item} key={item.id} />
                ))}
              </CardContent>
            </Card>
          </div>

          <DataTable
            caption="Application queue"
            columns={[
              { key: "applicant", label: "Applicant" },
              { key: "type", label: "Type" },
              { key: "preferred_stall", label: "Preferred Stall" },
              { key: "documents", label: "Documents" },
              { key: "status", label: "Status" },
              { key: "updated", label: "Updated" },
            ]}
            rows={data.applicationQueue}
          />
        </>
      ) : null}
    </div>
  );
}

// ─── Vendors ──────────────────────────────────────────────────────────────────

export function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.vendors, queryFn: fetchVendorRegistry, enabled: isSupabaseConfigured });
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", businessName: "", businessType: "", status: "Active" });

  const openEdit = (id: string) => {
    const v = data?.rows.find((r) => r.id === id);
    if (!v) return;
    setEditId(id);
    setForm({ fullName: v.fullName, email: v.email, phone: v.phone, businessName: v.businessName, businessType: v.businessType, status: v.status });
  };

  const selected = data?.rows.find((r) => r.id === editId);

  const saveVendor = useMutation({
    mutationFn: async () => updateVendorRecord(user!.id, { profileId: selected!.profileId, vendorId: selected!.id, ...form }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.vendors }); toast.success("Vendor record updated."); setEditId(null); },
    onError: (e) => toast.error(String(e)),
  });

  const notifyVendor = useMutation({
    mutationFn: async () => createAdminNotification(user!.id, { userId: selected!.profileId, title: "Account update", message: `${form.businessName} was updated by the market office.`, type: "update", link: "/vendor/profile" }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.notifications }); toast.success("Vendor notification sent."); },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader description="Track vendor occupancy, payment health, and lease posture from a single registry." eyebrow="Admin module" title="Vendor registry" />
      {isPending ? <LoadingCard message="Loading vendor registry..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
      {data ? (
        <>
          <SummaryGrid summary={data.summary} />
          <Tbl head={["Business name", "Full name", "Status", "Assigned stall", "Balance", "Actions"]}>
            {data.rows.map((item) => (
              <Tr key={item.id}>
                <Td><span className="font-medium text-foreground">{item.businessName}</span></Td>
                <Td className="text-muted-foreground">{item.fullName}</Td>
                <Td><StatusBadge status={item.status} /></Td>
                <Td>{item.assignedStall}</Td>
                <Td>{formatCurrency(item.balance)}</Td>
                <Td>
                  <Button onClick={() => openEdit(item.id)} size="sm" variant="outline">
                    <PencilLine className="mr-2 h-3 w-3" />Edit
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbl>
        </>
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
    </div>
  );
}

// ─── Applications ─────────────────────────────────────────────────────────────

export function AdminApplicationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.applications, queryFn: fetchApplications, enabled: isSupabaseConfigured });
  const { data: vendorOptions = [] } = useQuery({ queryKey: queryKeys.vendorOptions, queryFn: fetchVendorOptions, enabled: isSupabaseConfigured });
  const [modal, setModal] = useState<"review" | "details" | "walk-in" | null>(null);
  const [reviewId, setReviewId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
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
    onError: (e) => toast.error(String(e)),
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
    onError: (e) => toast.error(String(e)),
  });

  const createWalkIn = useMutation({
    mutationFn: async () => createWalkInApplication(user!.id, walkIn),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.applications }), queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })]);
      toast.success("Walk-in application created.");
      setModal(null);
      setWalkIn({ vendorId: "", businessType: "", preferredSection: "Dry Goods", preferredStallType: "General Merchandise", remarks: "" });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button onClick={() => setModal("walk-in")} variant="secondary">
            <Plus className="mr-2 h-4 w-4" />Walk-in application
          </Button>
        }
        description="Queue and resolve online and walk-in stall applications with clear rejection and resubmission paths."
        eyebrow="Admin module"
        title="Application management"
      />
      {isPending ? <LoadingCard message="Loading applications..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
      {data ? (
        <>
          <SummaryGrid summary={data.summary} />
          <Tbl head={["Vendor", "Business type", "Preferred stall", "Documents", "Status", "Updated", "Actions"]}>
            {data.rows.map((item) => (
              <Tr key={item.id}>
                <Td><span className="font-medium text-foreground">{item.vendorName}</span></Td>
                <Td className="text-muted-foreground">{item.businessType}</Td>
                <Td>{item.preferredStallLabel}</Td>
                <Td>{item.documentsVerified} / {item.documentsUploaded} verified</Td>
                <Td><StatusBadge status={item.status} /></Td>
                <Td className="text-muted-foreground">{item.updatedAt}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button onClick={() => openDetails(item.id)} size="sm" variant="outline">
                      View
                    </Button>
                    <Button onClick={() => openReview(item.id)} size="sm" variant="outline">
                      <PencilLine className="mr-2 h-3 w-3" />Review
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbl>
        </>
      ) : null}

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
          <ModalFooter>
            <Button onClick={() => review.mutate("under_review")} variant="outline">Mark under review</Button>
            <Button onClick={() => review.mutate("approved")}><CheckCircle2 className="mr-2 h-4 w-4" />Approve</Button>
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
    </div>
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
    onError: (e) => toast.error(String(e)),
  });

  const remove = useMutation({
    mutationFn: async () => deleteStall(user!.id, editId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.stalls });
      toast.success("Stall deleted.");
      setModal(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === "map" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                onClick={() => setView("map")}
                type="button"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Map
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                onClick={() => setView("list")}
                type="button"
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
            <Button onClick={openCreate} variant="secondary"><Plus className="mr-2 h-4 w-4" />New stall</Button>
          </div>
        }
        description="Manage sections, rates, and occupancy status with visibility into open inventory."
        eyebrow="Admin module"
        title="Stall inventory"
      />
      {isPending ? <LoadingCard message="Loading stalls..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
      {data ? (
        <>
          <SummaryGrid summary={data.summary} />
          {view === "map" ? (
            <StallHeatMap onEdit={openEdit} stalls={data.rows} />
          ) : (
            <Tbl head={["Stall", "Type", "Section", "Monthly rate", "Status", "Notes", "Actions"]}>
              {data.rows.map((item) => (
                <Tr key={item.id}>
                  <Td><span className="font-medium text-foreground">{item.stall}</span></Td>
                  <Td className="text-muted-foreground">{item.type}</Td>
                  <Td>{item.section}</Td>
                  <Td>{formatCurrency(item.rate)}</Td>
                  <Td><StatusBadge status={item.status} /></Td>
                  <Td className="max-w-[180px] truncate text-muted-foreground">{item.notes || "—"}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button onClick={() => openEdit(item.id)} size="sm" variant="outline"><PencilLine className="mr-2 h-3 w-3" />Edit</Button>
                      <Button onClick={() => openDelete(item.id)} size="sm" variant="destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbl>
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
            <Field label="Stall type"><Input onChange={(e) => setForm((c) => ({ ...c, stallType: e.target.value }))} value={form.stallType} /></Field>
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

// ─── Assignments ──────────────────────────────────────────────────────────────

export function AdminAssignmentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: assignments = [], isPending, error } = useQuery({ queryKey: queryKeys.assignments, queryFn: fetchAssignments, enabled: isSupabaseConfigured });
  const { data: applications } = useQuery({ queryKey: queryKeys.applications, queryFn: fetchApplications, enabled: isSupabaseConfigured });
  const { data: stallOptions = [] } = useQuery({ queryKey: queryKeys.stallOptions, queryFn: () => fetchStallOptions(["available", "reserved"]), enabled: isSupabaseConfigured });
  const approvedApplications = (applications?.rows ?? []).filter((item) => item.status === "Approved");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ applicationId: "", stallId: "", startDate: todayIso(), endDate: "", monthlyRate: "1250" });

  const assign = useMutation({
    mutationFn: async () => createAssignment(user!.id, { applicationId: form.applicationId, stallId: form.stallId, startDate: form.startDate, endDate: form.endDate, monthlyRate: Number(form.monthlyRate) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.assignments }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stalls }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leases }),
      ]);
      toast.success("Assignment created.");
      setShowModal(false);
      setForm({ applicationId: "", stallId: "", startDate: todayIso(), endDate: "", monthlyRate: "1250" });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Button onClick={() => setShowModal(true)} variant="secondary"><MapPinned className="mr-2 h-4 w-4" />Create assignment</Button>}
        description="Link approved applicants to stalls and create active lease assignments."
        eyebrow="Admin module"
        title="Stall assignments"
      />
      {isPending ? <LoadingCard message="Loading assignments..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
      <Tbl head={["Vendor", "Stall", "Start date", "End date", "Status"]}>
        {assignments.map((item) => (
          <Tr key={item.leaseId}>
            <Td><span className="font-medium text-foreground">{item.vendor}</span></Td>
            <Td>{item.stall}</Td>
            <Td className="text-muted-foreground">{item.startDate}</Td>
            <Td className="text-muted-foreground">{item.endDate}</Td>
            <Td><StatusBadge status={item.status} /></Td>
          </Tr>
        ))}
      </Tbl>

      {showModal ? (
        <Modal onClose={() => setShowModal(false)} title="Create assignment">
          <Field label="Approved application">
            <Select onChange={(e) => setForm((c) => ({ ...c, applicationId: e.target.value }))} value={form.applicationId}>
              <option value="">Select application</option>
              {approvedApplications.map((item) => <option key={item.id} value={item.id}>{item.vendorName} — {item.businessType}</option>)}
            </Select>
          </Field>
          <Field label="Available stall">
            <Select onChange={(e) => setForm((c) => ({ ...c, stallId: e.target.value }))} value={form.stallId}>
              <option value="">Select stall</option>
              {stallOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </Field>
          <FormGrid>
            <Field label="Start date"><Input onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))} type="date" value={form.startDate} /></Field>
            <Field label="End date"><Input onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))} type="date" value={form.endDate} /></Field>
            <Field label="Monthly rate"><Input onChange={(e) => setForm((c) => ({ ...c, monthlyRate: e.target.value }))} type="number" value={form.monthlyRate} /></Field>
          </FormGrid>
          <ModalFooter>
            <Button disabled={!form.applicationId || !form.stallId || assign.isPending} onClick={() => assign.mutate()}>
              <MapPinned className="mr-2 h-4 w-4" />Create assignment
            </Button>
            <Button onClick={() => setShowModal(false)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Leases ───────────────────────────────────────────────────────────────────

export function AdminLeasesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.leases, queryFn: fetchLeases, enabled: isSupabaseConfigured });
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ endDate: "", monthlyRate: "0", status: "Active", renewalStatus: "Not Due" });

  const selected = data?.rows.find((r) => r.id === editId);

  const openEdit = (id: string) => {
    const lease = data?.rows.find((r) => r.id === id);
    if (!lease) return;
    setEditId(id);
    setForm({ endDate: lease.leaseEndIso, monthlyRate: String(lease.monthlyRate), status: lease.status, renewalStatus: lease.renewalStatus });
  };

  const save = useMutation({
    mutationFn: async () => updateLease(user!.id, { leaseId: editId!, endDate: form.endDate, monthlyRate: Number(form.monthlyRate), status: form.status, renewalStatus: form.renewalStatus }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.leases }), queryClient.invalidateQueries({ queryKey: queryKeys.assignments }), queryClient.invalidateQueries({ queryKey: queryKeys.stalls })]);
      toast.success("Lease updated.");
      setEditId(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader description="Monitor active contracts, renewal states, and lease lifecycle changes." eyebrow="Admin module" title="Lease and renewal tracker" />
      {isPending ? <LoadingCard message="Loading leases..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
      {data ? (
        <>
          <SummaryGrid summary={data.summary} />
          <Tbl head={["Vendor", "Stall", "Lease end", "Monthly rate", "Status", "Renewal", "Actions"]}>
            {data.rows.map((item) => (
              <Tr key={item.id}>
                <Td><span className="font-medium text-foreground">{item.vendor}</span></Td>
                <Td>{item.stall}</Td>
                <Td className="text-muted-foreground">{item.leaseEnd}</Td>
                <Td>{formatCurrency(item.monthlyRate)}</Td>
                <Td><StatusBadge status={item.status} /></Td>
                <Td><StatusBadge status={item.renewalStatus} /></Td>
                <Td>
                  <Button onClick={() => openEdit(item.id)} size="sm" variant="outline"><PencilLine className="mr-2 h-3 w-3" />Edit</Button>
                </Td>
              </Tr>
            ))}
          </Tbl>
        </>
      ) : null}

      {editId && selected ? (
        <Modal onClose={() => setEditId(null)} title={`Edit lease — ${selected.vendor}`}>
          <FormGrid>
            <Field label="End date"><Input onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))} type="date" value={form.endDate} /></Field>
            <Field label="Monthly rate"><Input onChange={(e) => setForm((c) => ({ ...c, monthlyRate: e.target.value }))} type="number" value={form.monthlyRate} /></Field>
            <Field label="Status">
              <Select onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))} value={form.status}>
                <option>Draft</option><option>Active</option><option>Expired</option><option>Terminated</option>
              </Select>
            </Field>
            <Field label="Renewal status">
              <Select onChange={(e) => setForm((c) => ({ ...c, renewalStatus: e.target.value }))} value={form.renewalStatus}>
                <option>Not Due</option><option>Due Soon</option><option>In Progress</option><option>Renewed</option><option>Expired</option>
              </Select>
            </Field>
          </FormGrid>
          <ModalFooter>
            <Button disabled={save.isPending} onClick={() => save.mutate()}><ClipboardCheck className="mr-2 h-4 w-4" />Save lease</Button>
            <Button onClick={() => setEditId(null)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export function AdminBillingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.billings, queryFn: fetchBillings, enabled: isSupabaseConfigured });
  const { data: leaseOptions = [] } = useQuery({ queryKey: queryKeys.leaseOptions, queryFn: fetchLeaseOptions, enabled: isSupabaseConfigured });
  const [editId, setEditId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leaseId: "", billingMonth: todayIso(), amountDue: "0", dueDate: todayIso(), penalties: "0", notes: "" });

  const selected = data?.rows.find((r) => r.id === editId);

  const openCreate = () => {
    setEditId(null);
    setForm({ leaseId: "", billingMonth: todayIso(), amountDue: "0", dueDate: todayIso(), penalties: "0", notes: "" });
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    const b = data?.rows.find((r) => r.id === id);
    if (!b) return;
    setEditId(id);
    setForm({ leaseId: b.leaseId, billingMonth: b.billingMonthIso, amountDue: String(b.amountDue), dueDate: b.dueDateIso, penalties: String(b.penalties), notes: b.notes });
    setShowModal(true);
  };

  const save = useMutation({
    mutationFn: async () =>
      editId
        ? updateBilling(user!.id, { billingId: editId, billingMonth: form.billingMonth, amountDue: Number(form.amountDue), dueDate: form.dueDate, penalties: Number(form.penalties), notes: form.notes })
        : createBilling(user!.id, { leaseId: form.leaseId, billingMonth: form.billingMonth, amountDue: Number(form.amountDue), dueDate: form.dueDate, penalties: Number(form.penalties), notes: form.notes }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.billings }), queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })]);
      toast.success(editId ? "Billing updated." : "Billing created.");
      setShowModal(false);
    },
    onError: (e) => toast.error(String(e)),
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
      {error ? <ErrorCard message={String(error)} /> : null}
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
          <Field label="Lease">
            <Select disabled={Boolean(editId)} onChange={(e) => setForm((c) => ({ ...c, leaseId: e.target.value }))} value={form.leaseId}>
              <option value="">Select lease</option>
              {leaseOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </Field>
          <FormGrid>
            <Field label="Billing month"><Input onChange={(e) => setForm((c) => ({ ...c, billingMonth: e.target.value }))} type="date" value={form.billingMonth} /></Field>
            <Field label="Due date"><Input onChange={(e) => setForm((c) => ({ ...c, dueDate: e.target.value }))} type="date" value={form.dueDate} /></Field>
            <Field label="Amount due"><Input onChange={(e) => setForm((c) => ({ ...c, amountDue: e.target.value }))} type="number" value={form.amountDue} /></Field>
            <Field label="Penalties"><Input onChange={(e) => setForm((c) => ({ ...c, penalties: e.target.value }))} type="number" value={form.penalties} /></Field>
          </FormGrid>
          <Field label="Notes"><Textarea onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} rows={3} value={form.notes} /></Field>
          <ModalFooter>
            <Button disabled={save.isPending} onClick={() => save.mutate()}><WalletCards className="mr-2 h-4 w-4" />{editId ? "Save billing" : "Create billing"}</Button>
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
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.payments, queryFn: fetchPayments, enabled: isSupabaseConfigured });
  const { data: billingRows } = useQuery({ queryKey: queryKeys.billings, queryFn: fetchBillings, enabled: isSupabaseConfigured });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ billingId: "", amount: "0", paymentDate: todayIso(), method: "Cash", receiptNumber: "", notes: "" });

  const save = useMutation({
    mutationFn: async () => createPayment(user!.id, { billingId: form.billingId, amount: Number(form.amount), paymentDate: form.paymentDate, method: form.method, receiptNumber: form.receiptNumber, notes: form.notes }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.payments }), queryClient.invalidateQueries({ queryKey: queryKeys.billings })]);
      toast.success("Payment recorded.");
      setShowModal(false);
      setForm({ billingId: "", amount: "0", paymentDate: todayIso(), method: "Cash", receiptNumber: "", notes: "" });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Button onClick={() => setShowModal(true)} variant="secondary"><WalletCards className="mr-2 h-4 w-4" />Record payment</Button>}
        description="Review collected payments and encode new cashier-side entries."
        eyebrow="Admin module"
        title="Payments ledger"
      />
      {isPending ? <LoadingCard message="Loading payments..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
      {data ? (
        <>
          <SummaryGrid summary={data.summary} />
          <Tbl head={["Vendor", "Receipt", "Amount", "Payment date", "Method"]}>
            {data.rows.map((item) => (
              <Tr key={item.id}>
                <Td><span className="font-medium text-foreground">{item.vendor}</span></Td>
                <Td className="text-muted-foreground">{item.receipt || "—"}</Td>
                <Td>{formatCurrency(item.amount)}</Td>
                <Td className="text-muted-foreground">{item.paymentDate}</Td>
                <Td><StatusBadge status={item.method} /></Td>
              </Tr>
            ))}
          </Tbl>
        </>
      ) : null}

      {showModal ? (
        <Modal onClose={() => setShowModal(false)} title="Record payment">
          <Field label="Billing record">
            <Select onChange={(e) => setForm((c) => ({ ...c, billingId: e.target.value }))} value={form.billingId}>
              <option value="">Select billing</option>
              {(billingRows?.rows ?? []).map((item) => <option key={item.id} value={item.id}>{item.vendor} — {item.billingMonth}</option>)}
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
            <Button disabled={!form.billingId || save.isPending} onClick={() => save.mutate()}><WalletCards className="mr-2 h-4 w-4" />Record payment</Button>
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.violations });
      toast.success(editId ? "Violation updated." : "Violation recorded.");
      setModal(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  const remove = useMutation({
    mutationFn: async () => deleteViolation(user!.id, editId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.violations });
      toast.success("Violation deleted.");
      setModal(null);
    },
    onError: (e) => toast.error(String(e)),
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
      {error ? <ErrorCard message={String(error)} /> : null}
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
    <div className="space-y-6">
      <PageHeader
        action={
          <div className="flex gap-3">
            <Button onClick={exportCsv} variant="outline"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
            <Button onClick={() => window.print()} variant="secondary"><Printer className="mr-2 h-4 w-4" />Print</Button>
          </div>
        }
        description="Generate filterable and print-friendly operational reports for occupancy, payments, compliance, and lease renewals."
        eyebrow="Reporting"
        title="Operational reporting module"
      />

      <ReportFilters onChange={(field, value) => setFilters((c) => ({ ...c, [field]: value }))} onGenerate={() => void refetch()} sections={sectionNames} values={filters} />

      {isPending ? <LoadingCard message="Loading reports..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
      {data ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            {data.summary.map((item) => (
              <Card key={item.label}>
                <CardHeader className="pb-2">
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <CardTitle className="text-3xl">{item.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{item.note}</CardContent>
              </Card>
            ))}
          </div>
          <DataTable
            columns={[
              { key: "report", label: "Report" },
              { key: "filter_scope", label: "Filter scope" },
              { key: "generated_at", label: "Generated at" },
              { key: "coverage", label: "Coverage" },
              { key: "status", label: "Status" },
            ]}
            rows={data.rows}
          />
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
    onError: (e) => toast.error(String(e)),
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
      {error ? <ErrorCard message={String(error)} /> : null}
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
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader description="Manage existing LGU staff records and route-level roles." eyebrow="Admin module" title="Staff management" />
      {isPending ? <LoadingCard message="Loading staff..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
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
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({ name: "", description: "", isRequired: true, hasExpiry: true, sortOrder: "0" });

  useEffect(() => {
    if (!data) return;
    setBilling({ billingDay: String(data.billingSettings.billingDay), penaltyAmount: String(data.billingSettings.penaltyAmount), reminderDaysBefore: String(data.billingSettings.reminderDaysBefore) });
    setTemplates(data.notificationTemplates);
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
    onError: (e) => toast.error(String(e)),
  });

  const saveTemplates = useMutation({
    mutationFn: async () => saveSystemSetting(user!.id, "notification_templates", templates),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.settings }); toast.success("Notification templates saved."); },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader description="Configure document requirements, billing cadence, and notification templates." eyebrow="Configuration" title="System settings" />
      {isPending ? <LoadingCard message="Loading settings..." /> : null}
      {error ? <ErrorCard message={String(error)} /> : null}
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
