import type { ActivityItem, MetricCardData } from "@/types/domain";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOption {
  label: string;
  value: string;
}

export interface SectionOption extends AdminOption {}

export interface VendorRegistryRecord {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  status: string;
  assignedStall: string;
  balance: number;
  lastPayment: string;
}

export interface AdminApplicationRecord {
  id: string;
  vendorId: string;
  vendorProfileId: string;
  vendorName: string;
  businessType: string;
  preferredSection: string;
  preferredStallType: string;
  preferredStallId?: string;
  preferredStallLabel: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
  remarks: string;
  rejectionReason: string;
  documentsUploaded: number;
  documentsVerified: number;
}

export interface AdminStallRecord {
  id: string;
  sectionId: string;
  section: string;
  stallNumber: string;
  stall: string;
  type: string;
  rate: number;
  status: string;
  notes: string;
  currentVendorId: string | null;
  currentVendorName: string | null;
  currentVendorEmail: string | null;
  currentVendorPhone: string | null;
}

export interface AdminBillingRecord {
  id: string;
  vendorId: string;
  vendorProfileId: string;
  vendor: string;
  stall: string;
  billingMonth: string;
  billingMonthIso: string;
  baseAmount: number;
  amountDue: number;
  dueDate: string;
  dueDateIso: string;
  amountPaid: number;
  status: string;
  penalties: number;
  notes: string;
}

export interface AdminPaymentRecord {
  id: string;
  billingId: string;
  vendorId: string;
  vendorProfileId: string;
  vendor: string;
  amount: number;
  paymentDate: string;
  paymentDateIso: string;
  method: string;
  receipt: string;
  internalReference: string;
  verificationStatus: string;
  proofPath: string | null;
  proofUrl: string | null;
  paymentGroupId: string;
  recordedBy: string;
  notes: string;
}

export interface AdminViolationRecord {
  id: string;
  vendorId: string;
  vendorProfileId: string;
  vendor: string;
  stallId?: string;
  stall: string;
  category: string;
  description: string;
  date: string;
  dateIso: string;
  penalty: number;
  action: string;
  status: string;
}

export interface AdminNotificationRecord {
  id: string;
  userId: string;
  recipient: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string;
  createdAt: string;
  createdAtIso: string;
}

export interface AdminStaffRecord {
  id: string;
  profileId: string;
  name: string;
  role: string;
  email: string;
  positionTitle: string;
  isActive: boolean;
}

export interface AdminDocumentRequirementRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  isRequired: boolean;
  hasExpiry: boolean;
  sortOrder: number;
}

export interface AdminSettingsSnapshot {
  documentRequirements: AdminDocumentRequirementRecord[];
  billingSettings: {
    billingDay: number;
    penaltyAmount: number;
    reminderDaysBefore: number;
  };
  notificationTemplates: {
    approval: string;
    rejection: string;
    overdue: string;
  };
  paymentMethods: string[];
  pickupInformation: {
    enabled: boolean;
    schedule: string;
    location: string;
    contact: string;
    instructions: string;
  };
}

export interface AdminDashboardSnapshot {
  metrics: MetricCardData[];
  activities: ActivityItem[];
  applicationQueue: Array<Record<string, string>>;
  applicationStatusBreakdown: Array<{ label: string; value: number; color: string }>;
  documentStatusBreakdown: Array<{ label: string; value: number; color: string }>;
  monthlyCollections: Array<{ month: string; collected: number; target: number }>;
  occupancyBySection: Array<{ section: string; occupied: number; available: number }>;
}

export interface AdminDocumentRecord {
  id: string;
  applicationId: string;
  vendorProfileId: string;
  vendorName: string;
  document: string;
  expiry: string;
  status: string;
  remarks: string;
  uploadedAt: string;
  fileUrl?: string;
  fileName?: string;
}

export interface AdminReportsSnapshot {
  summary: Array<{ label: string; value: string; note: string }>;
  rows: Array<Record<string, string>>;
}

export interface ReportFiltersInput {
  month: string;
  year: string;
  section: string;
  stallNumber: string;
  vendorName: string;
  paymentStatus: string;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function monthKey(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function titleizeStatus(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

interface CoreMaps {
  profiles: Array<{ id: string; full_name: string; email: string; phone: string | null; role: string }>;
  vendors: Array<{ id: string; profile_id: string; business_name: string; business_type: string | null; status: string }>;
  sections: Array<{ id: string; name: string; code: string }>;
  stalls: Array<{ id: string; section_id: string; stall_number: string; stall_type: string; monthly_rate: number; status: string; notes: string | null; vendor_id: string | null }>;
  profileById: Map<string, CoreMaps["profiles"][number]>;
  vendorById: Map<string, CoreMaps["vendors"][number]>;
  vendorByProfileId: Map<string, CoreMaps["vendors"][number]>;
  sectionById: Map<string, CoreMaps["sections"][number]>;
  stallById: Map<string, CoreMaps["stalls"][number] & { label: string }>;
}

async function logActivity(
  actorId: string,
  action: string,
  entityName: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  const db = requireSupabase();
  await db.from("activity_logs").insert({
    actor_id: actorId,
    action,
    entity_name: entityName,
    entity_id: entityId,
    metadata,
  });
}

async function notifyUser(userId: string, title: string, message: string, type: string, link = "") {
  const db = requireSupabase();
  const { error } = await db.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    link,
  });

  if (error) {
    throw error;
  }
}

async function loadCoreMaps(): Promise<CoreMaps> {
  const db = requireSupabase();
  const [profilesResult, vendorsResult, sectionsResult, stallsResult] = await Promise.all([
    db.from("profiles").select("id, full_name, email, phone, role"),
    db.from("vendors").select("id, profile_id, business_name, business_type, status"),
    db.from("market_sections").select("id, name, code").order("sort_order", { ascending: true }),
    db.from("stalls").select("id, section_id, stall_number, stall_type, monthly_rate, status, notes, vendor_id"),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (vendorsResult.error) throw vendorsResult.error;
  if (sectionsResult.error) throw sectionsResult.error;
  if (stallsResult.error) throw stallsResult.error;

  const profiles = profilesResult.data ?? [];
  const vendors = vendorsResult.data ?? [];
  const sections = sectionsResult.data ?? [];
  const stalls = (stallsResult.data ?? []).map((s) => ({ ...s, vendor_id: s.vendor_id ?? null }));

  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const vendorById = new Map(vendors.map((item) => [item.id, item]));
  const vendorByProfileId = new Map(vendors.map((item) => [item.profile_id, item]));
  const sectionById = new Map(sections.map((item) => [item.id, item]));
  const stallById = new Map(
    stalls.map((item) => [
      item.id,
      {
        ...item,
        label: `${sectionById.get(item.section_id)?.name ?? "Section"} ${item.stall_number}`,
      },
    ]),
  );

  return {
    profiles,
    vendors,
    sections,
    stalls,
    profileById,
    vendorById,
    vendorByProfileId,
    sectionById,
    stallById,
  };
}

export async function fetchAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const [applicationsResult, documentsResult, billingsResult, paymentsResult, activitiesResult] =
    await Promise.all([
      db.from("applications").select("id, vendor_id, preferred_stall_id, status, updated_at, application_type"),
      db.from("application_documents").select("id, application_id, verification_status"),
      db.from("billings").select("id, amount_due, amount_paid, status, due_date"),
      db.from("payments").select("id, amount, payment_date").eq("verification_status", "verified"),
      db.from("activity_logs").select("id, action, entity_name, entity_id, metadata, created_at").order("created_at", { ascending: false }).limit(5),
    ]);

  if (applicationsResult.error) throw applicationsResult.error;
  if (documentsResult.error) throw documentsResult.error;
  if (billingsResult.error) throw billingsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (activitiesResult.error) throw activitiesResult.error;

  const applications = applicationsResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const billings = billingsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const activities = activitiesResult.data ?? [];

  const docsByApplication = new Map<string, { total: number; verified: number }>();
  for (const doc of documents) {
    const current = docsByApplication.get(doc.application_id) ?? { total: 0, verified: 0 };
    current.total += 1;
    if (doc.verification_status === "verified") {
      current.verified += 1;
    }
    docsByApplication.set(doc.application_id, current);
  }

  const applicationQueue = applications.slice(0, 6).map((item) => {
    const vendor = core.vendorById.get(item.vendor_id);
    const profile = vendor ? core.profileById.get(vendor.profile_id) : null;
    const preferredStall = item.preferred_stall_id ? core.stallById.get(item.preferred_stall_id) : null;
    const docs = docsByApplication.get(item.id) ?? { total: 0, verified: 0 };

    return {
      applicant: vendor?.business_name ?? profile?.full_name ?? "Unknown vendor",
      type: item.application_type === "walk_in" ? "Walk-in" : "Online",
      preferred_stall: preferredStall?.label ?? "Pending preference",
      documents: `${docs.verified} / ${docs.total || 0} verified`,
      status: titleizeStatus(item.status),
      updated: formatDateTime(item.updated_at),
    };
  });

  const applicationStatusMap = new Map<string, number>();
  for (const item of applications) {
    applicationStatusMap.set(item.status, (applicationStatusMap.get(item.status) ?? 0) + 1);
  }

  const documentStatusMap = new Map<string, number>();
  for (const item of documents) {
    documentStatusMap.set(item.verification_status, (documentStatusMap.get(item.verification_status) ?? 0) + 1);
  }

  const occupancyMap = new Map<string, { occupied: number; available: number }>();
  for (const stall of core.stalls) {
    const section = core.sectionById.get(stall.section_id)?.name ?? "Unassigned";
    const current = occupancyMap.get(section) ?? { occupied: 0, available: 0 };
    if (stall.status === "occupied" || stall.status === "reserved") {
      current.occupied += 1;
    } else {
      current.available += 1;
    }
    occupancyMap.set(section, current);
  }

  const collectionsByMonth = new Map<string, number>();
  for (const payment of payments) {
    const key = monthKey(payment.payment_date);
    collectionsByMonth.set(key, (collectionsByMonth.get(key) ?? 0) + Number(payment.amount ?? 0));
  }

  const overdueCount = billings.filter((item) => item.status === "overdue").length;
  const outstanding = billings.reduce(
    (sum, item) => sum + Math.max(Number(item.amount_due ?? 0) - Number(item.amount_paid ?? 0), 0),
    0,
  );

  return {
    metrics: [
      {
        label: "Total stalls",
        value: `${core.stalls.length}`,
        delta: `${core.stalls.length} records available`,
      },
      {
        label: "Occupied stalls",
        value: `${core.stalls.filter((item) => item.status === "occupied").length}`,
        delta: `${core.stalls.filter((item) => item.status === "available").length} available`,
        tone: "positive",
      },
      {
        label: "Pending applications",
        value: `${applications.filter((item) => item.status === "submitted" || item.status === "under_review").length}`,
        delta: `${applications.filter((item) => item.status === "needs_resubmission").length} need resubmission`,
        tone: "warning",
      },
      {
        label: "Outstanding balance",
        value: formatCurrency(outstanding),
        delta: `${overdueCount} overdue accounts`,
        tone: overdueCount > 0 ? "warning" : "neutral",
      },
    ],
    activities: activities.map((item) => ({
      id: item.id,
      title: `${titleizeStatus(item.action)} ${item.entity_name}`,
      detail: JSON.stringify(item.metadata ?? {}).replace(/[{}"]/g, "") || "Back-office activity recorded.",
      timestamp: formatDateTime(item.created_at),
      status: titleizeStatus(item.action),
    })),
    applicationQueue,
    applicationStatusBreakdown: [
      { label: "Draft", value: applicationStatusMap.get("draft") ?? 0, color: "#CBD5E1" },
      { label: "Under Review", value: applicationStatusMap.get("under_review") ?? 0, color: "#F59E0B" },
      { label: "Approved", value: applicationStatusMap.get("approved") ?? 0, color: "#0F766E" },
      { label: "Needs Resubmission", value: applicationStatusMap.get("needs_resubmission") ?? 0, color: "#DC2626" },
      { label: "Assigned", value: applicationStatusMap.get("assigned") ?? 0, color: "#2563EB" },
    ],
    documentStatusBreakdown: [
      { label: "Verified", value: documentStatusMap.get("verified") ?? 0, color: "#15803D" },
      { label: "Pending", value: documentStatusMap.get("pending") ?? 0, color: "#D97706" },
      { label: "Needs Resubmission", value: documentStatusMap.get("needs_resubmission") ?? 0, color: "#B91C1C" },
    ],
    monthlyCollections: Array.from(collectionsByMonth.entries()).map(([month, collected]) => ({
      month,
      collected,
      target: collected,
    })),
    occupancyBySection: Array.from(occupancyMap.entries()).map(([section, values]) => ({
      section,
      occupied: values.occupied,
      available: values.available,
    })),
  };
}

export async function fetchSectionOptions(): Promise<SectionOption[]> {
  const { sections } = await loadCoreMaps();
  return sections.map((item) => ({ label: item.name, value: item.id }));
}

export async function fetchVendorOptions(): Promise<AdminOption[]> {
  const core = await loadCoreMaps();
  return core.vendors.map((item) => ({
    label: core.profileById.get(item.profile_id)?.full_name ?? item.business_name,
    value: item.id,
  }));
}

export async function fetchVendorLeaseRates(): Promise<Record<string, number | null>> {
  const core = await loadCoreMaps();
  const out: Record<string, number | null> = {};
  for (const vendor of core.vendors) {
    const stall = core.stalls.find((s) => s.status === "occupied" && s.vendor_id === vendor.id);
    out[vendor.id] = stall ? Number(stall.monthly_rate ?? null) : null;
  }
  return out;
}

export async function fetchUserOptions(): Promise<AdminOption[]> {
  const core = await loadCoreMaps();
  return core.profiles.map((item) => ({
    label: `${item.full_name} (${item.email})`,
    value: item.id,
  }));
}

export async function fetchStallOptions(status?: string[]): Promise<AdminOption[]> {
  const core = await loadCoreMaps();
  return core.stalls
    .filter((item) => !status || status.includes(item.status))
    .map((item) => ({
      label: core.stallById.get(item.id)?.label ?? item.stall_number,
      value: item.id,
    }));
}

export async function fetchVendorRegistry(): Promise<{
  summary: [string, string][];
  rows: VendorRegistryRecord[];
}> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const [billingsResult, paymentsResult, violationsResult] = await Promise.all([
    db.from("billings").select("id, vendor_id, amount_due, amount_paid"),
    db.from("payments").select("id, vendor_id, payment_date").eq("verification_status", "verified").order("payment_date", { ascending: false }),
    db.from("violations").select("stall_id, vendor_id").order("created_at", { ascending: false }),
  ]);

  if (billingsResult.error) throw billingsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const billings = billingsResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  const stallByVendorId = new Map<string, string>();
  for (const v of violationsResult.data ?? []) {
    if (v.stall_id && v.vendor_id && !stallByVendorId.has(v.vendor_id)) {
      stallByVendorId.set(v.vendor_id, v.stall_id);
    }
  }

  const balanceByVendor = new Map<string, number>();
  for (const billing of billings) {
    if (!billing.vendor_id) continue;
    const existing = balanceByVendor.get(billing.vendor_id) ?? 0;
    balanceByVendor.set(billing.vendor_id, existing + Math.max(Number(billing.amount_due ?? 0) - Number(billing.amount_paid ?? 0), 0));
  }

  const lastPaymentByVendor = new Map<string, string>();
  for (const payment of payments) {
    if (!lastPaymentByVendor.has(payment.vendor_id)) {
      lastPaymentByVendor.set(payment.vendor_id, formatDate(payment.payment_date));
    }
  }

  const rows = core.vendors.map((vendor) => {
    const profile = core.profileById.get(vendor.profile_id);
    const stallId = stallByVendorId.get(vendor.id);
    const assignedStall = stallId ? core.stallById.get(stallId)?.label ?? "-" : "-";

    return {
      id: vendor.id,
      profileId: vendor.profile_id,
      fullName: profile?.full_name ?? vendor.business_name,
      email: profile?.email ?? "-",
      phone: profile?.phone ?? "-",
      businessName: vendor.business_name,
      businessType: vendor.business_type ?? "-",
      status: titleizeStatus(vendor.status),
      assignedStall,
      balance: balanceByVendor.get(vendor.id) ?? 0,
      lastPayment: lastPaymentByVendor.get(vendor.id) ?? "-",
    };
  });

  return {
    summary: [
      ["Active vendors", `${rows.filter((item) => item.status === "Active").length}`],
      ["Finance holds", `${rows.filter((item) => item.balance > 0).length}`],
      ["Registered vendors", `${rows.length}`],
    ],
    rows,
  };
}

export async function updateVendorRecord(
  actorId: string,
  input: {
    profileId: string;
    vendorId: string;
    fullName: string;
    email: string;
    phone: string;
    businessName: string;
    businessType: string;
    status: string;
  },
) {
  const db = requireSupabase();
  const { error: profileError } = await db
    .from("profiles")
    .update({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
    })
    .eq("id", input.profileId);

  if (profileError) throw profileError;

  const { error: vendorError } = await db
    .from("vendors")
    .update({
      business_name: input.businessName,
      business_type: input.businessType,
      status: input.status.toLowerCase().replace(/\s+/g, "_"),
    })
    .eq("id", input.vendorId);

  if (vendorError) throw vendorError;

  await logActivity(actorId, "updated", "vendor", input.vendorId, {
    businessName: input.businessName,
    status: input.status,
  });
}

export async function deleteVendor(actorId: string, vendorId: string) {
  const db = requireSupabase();

  const { error } = await db.from("vendors").delete().eq("id", vendorId);
  if (error) throw error;

  await logActivity(actorId, "deleted", "vendor", vendorId);
}

export async function fetchApplications(): Promise<{
  summary: [string, string][];
  rows: AdminApplicationRecord[];
}> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const [applicationsResult, documentsResult] = await Promise.all([
    db
      .from("applications")
      .select("id, vendor_id, preferred_stall_id, business_type, preferred_section, preferred_stall_type, status, submitted_at, updated_at, remarks, rejection_reason")
      .order("updated_at", { ascending: false }),
    db.from("application_documents").select("id, application_id, verification_status"),
  ]);

  if (applicationsResult.error) throw applicationsResult.error;
  if (documentsResult.error) throw documentsResult.error;

  const docsByApp = new Map<string, { uploaded: number; verified: number }>();
  for (const doc of documentsResult.data ?? []) {
    const current = docsByApp.get(doc.application_id) ?? { uploaded: 0, verified: 0 };
    current.uploaded += 1;
    if (doc.verification_status === "verified") {
      current.verified += 1;
    }
    docsByApp.set(doc.application_id, current);
  }

  const rows = (applicationsResult.data ?? []).map((item) => {
    const vendor = core.vendorById.get(item.vendor_id);
    const profile = vendor ? core.profileById.get(vendor.profile_id) : null;
    const preferredStall = item.preferred_stall_id ? core.stallById.get(item.preferred_stall_id) : null;
    const docs = docsByApp.get(item.id) ?? { uploaded: 0, verified: 0 };

    return {
      id: item.id,
      vendorId: item.vendor_id,
      vendorProfileId: vendor?.profile_id ?? "",
      vendorName: vendor?.business_name ?? profile?.full_name ?? "Unknown vendor",
      businessType: item.business_type ?? "-",
      preferredSection: item.preferred_section ?? preferredStall?.label.split(" ")[0] ?? "-",
      preferredStallType: item.preferred_stall_type ?? preferredStall?.stall_type ?? "-",
      preferredStallId: item.preferred_stall_id ?? undefined,
      preferredStallLabel: preferredStall?.label ?? "Pending assignment",
      status: titleizeStatus(item.status),
      submittedAt: formatDate(item.submitted_at),
      updatedAt: formatDateTime(item.updated_at),
      remarks: item.remarks ?? "",
      rejectionReason: item.rejection_reason ?? "",
      documentsUploaded: docs.uploaded,
      documentsVerified: docs.verified,
    };
  });

  return {
    summary: [
      ["Drafts", `${rows.filter((item) => item.status === "Draft").length}`],
      ["Under review", `${rows.filter((item) => item.status === "Under Review" || item.status === "Submitted").length}`],
      ["Needs resubmission", `${rows.filter((item) => item.status === "Needs Resubmission").length}`],
    ],
    rows,
  };
}

export async function fetchApplicationDocuments(applicationId: string): Promise<AdminDocumentRecord[]> {
  const db = requireSupabase();
  const [documentsResult, requirementsResult] = await Promise.all([
    db
      .from("application_documents")
      .select("id, application_id, requirement_id, verification_status, remarks, expiry_date, created_at, file_url, file_name")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true }),
    db.from("document_requirements").select("id, name"),
  ]);

  if (documentsResult.error) throw documentsResult.error;
  if (requirementsResult.error) throw requirementsResult.error;

  const requirementById = new Map((requirementsResult.data ?? []).map((item) => [item.id, item.name]));

  // Generate signed URLs for documents with real storage paths
  const storagePaths = (documentsResult.data ?? [])
    .map((d) => d.file_url)
    .filter((url): url is string => Boolean(url) && !url.startsWith("uploaded-via"));

  const signedUrlMap = new Map<string, string>();
  if (storagePaths.length > 0) {
    try {
      const { data: signedData } = await db.storage
        .from("vendor-documents")
        .createSignedUrls(storagePaths, 3600);
      (signedData ?? []).forEach((item) => {
        if (item.signedUrl && item.path) signedUrlMap.set(item.path, item.signedUrl);
      });
    } catch {
      // bucket not provisioned yet — degrade gracefully
    }
  }

  return (documentsResult.data ?? []).map((item) => ({
    id: item.id,
    applicationId: item.application_id,
    vendorProfileId: "",
    vendorName: "",
    document: requirementById.get(item.requirement_id) ?? item.file_name ?? "Document",
    expiry: formatDate(item.expiry_date),
    status: titleizeStatus(item.verification_status),
    remarks: item.remarks ?? "",
    uploadedAt: formatDateTime(item.created_at),
    fileUrl: item.file_url ? (signedUrlMap.get(item.file_url) ?? undefined) : undefined,
    fileName: item.file_name ?? undefined,
  }));
}

export async function createWalkInApplication(
  actorId: string,
  input: {
    vendorId: string;
    businessType: string;
    preferredSection: string;
    preferredStallType: string;
    remarks: string;
  },
) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("applications")
    .insert({
      vendor_id: input.vendorId,
      application_type: "walk_in",
      business_type: input.businessType,
      preferred_section: input.preferredSection,
      preferred_stall_type: input.preferredStallType,
      remarks: input.remarks,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  const { data: vendor, error: vendorError } = await db
    .from("vendors")
    .select("profile_id")
    .eq("id", input.vendorId)
    .single();

  if (vendorError) throw vendorError;

  await notifyUser(
    vendor.profile_id,
    "Walk-in application received",
    "Your stall application has been submitted by market staff.",
    "submitted",
    "/vendor/applications",
  );

  await logActivity(actorId, "created", "application", data.id, {
    type: "walk_in",
    vendorId: input.vendorId,
  });
}

export async function updateApplicationReview(
  actorId: string,
  input: {
    applicationId: string;
    status: "under_review" | "approved" | "needs_resubmission" | "rejected";
    remarks: string;
    rejectionReason: string;
  },
) {
  const db = requireSupabase();
  const { data: application, error: applicationError } = await db
    .from("applications")
    .select("id, vendor_id")
    .eq("id", input.applicationId)
    .single();

  if (applicationError) throw applicationError;

  const { error } = await db
    .from("applications")
    .update({
      status: input.status,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      remarks: input.remarks,
      rejection_reason: input.rejectionReason || null,
    })
    .eq("id", input.applicationId);

  if (error) throw error;

  const { data: vendor, error: vendorError } = await db
    .from("vendors")
    .select("profile_id")
    .eq("id", application.vendor_id)
    .single();

  if (vendorError) throw vendorError;

  await notifyUser(
    vendor.profile_id,
    "Application updated",
    `Your application status is now ${titleizeStatus(input.status)}.`,
    input.status,
    "/vendor/applications",
  );

  await logActivity(actorId, input.status, "application", input.applicationId, {
    remarks: input.remarks,
  });
}

function addMonthsIso(value: string, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export async function completeApplicationAssignment(
  actorId: string,
  input: {
    applicationId: string;
    stallId: string;
    remarks: string;
  },
) {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const { data: application, error: applicationError } = await db
    .from("applications")
    .select("id, vendor_id, preferred_stall_id, status, remarks")
    .eq("id", input.applicationId)
    .single();

  if (applicationError) throw applicationError;

  const { data: stall, error: stallError } = await db
    .from("stalls")
    .select("id, stall_number, stall_type, monthly_rate, status, section_id")
    .eq("id", input.stallId)
    .single();

  if (stallError) throw stallError;

  if (!stall) {
    throw new Error("Selected stall was not found.");
  }

  const stallVendorId = core.stallById.get(stall.id)?.vendor_id ?? null;
  if (stall.status === "occupied" && stallVendorId !== application.vendor_id) {
    throw new Error("Selected stall is already occupied.");
  }

  const { data: vendor, error: vendorError } = await db
    .from("vendors")
    .select("profile_id")
    .eq("id", application.vendor_id)
    .single();

  if (vendorError) throw vendorError;

  const nowIso = new Date().toISOString();

  const { error: stallErrorUpdate } = await db
    .from("stalls")
    .update({ status: "occupied", vendor_id: application.vendor_id })
    .eq("id", stall.id);
  if (stallErrorUpdate) throw stallErrorUpdate;

  const { error: applicationUpdateError } = await db
    .from("applications")
    .update({
      status: "assigned",
      preferred_stall_id: stall.id,
      reviewed_by: actorId,
      reviewed_at: nowIso,
      remarks: input.remarks || application.remarks || null,
      rejection_reason: null,
    })
    .eq("id", input.applicationId);

  if (applicationUpdateError) throw applicationUpdateError;

  await notifyUser(
    vendor.profile_id,
    "Application completed",
    `Your stall application has been completed and assigned to ${core.stallById.get(stall.id)?.label ?? `stall ${stall.stall_number}`}.`,
    "assigned",
    "/vendor/applications",
  );

  await logActivity(actorId, "assigned", "application", input.applicationId, {
    applicationId: input.applicationId,
    stallId: stall.id,
    monthlyRate: Number(stall.monthly_rate ?? 0),
  });
}

export async function fetchDocumentQueue(): Promise<{
  summary: [string, string][];
  rows: AdminDocumentRecord[];
}> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const [documentsResult, requirementsResult, applicationsResult] = await Promise.all([
    db
      .from("application_documents")
      .select("id, application_id, requirement_id, verification_status, remarks, expiry_date, created_at")
      .order("created_at", { ascending: false }),
    db.from("document_requirements").select("id, name"),
    db.from("applications").select("id, vendor_id"),
  ]);

  if (documentsResult.error) throw documentsResult.error;
  if (requirementsResult.error) throw requirementsResult.error;
  if (applicationsResult.error) throw applicationsResult.error;

  const requirementById = new Map((requirementsResult.data ?? []).map((item) => [item.id, item.name]));
  const applicationById = new Map((applicationsResult.data ?? []).map((item) => [item.id, item]));

  const rows = (documentsResult.data ?? []).map((item) => {
    const application = applicationById.get(item.application_id);
    const vendor = application ? core.vendorById.get(application.vendor_id) : null;

    return {
      id: item.id,
      applicationId: item.application_id,
      vendorProfileId: vendor?.profile_id ?? "",
      vendorName: vendor?.business_name ?? "Unknown vendor",
      document: requirementById.get(item.requirement_id) ?? "Document",
      expiry: formatDate(item.expiry_date),
      status: titleizeStatus(item.verification_status),
      remarks: item.remarks ?? "",
      uploadedAt: formatDateTime(item.created_at),
    };
  });

  return {
    summary: [
      ["Verified", `${rows.filter((item) => item.status === "Verified").length}`],
      ["Pending", `${rows.filter((item) => item.status === "Pending").length}`],
      ["Resubmission", `${rows.filter((item) => item.status === "Needs Resubmission").length}`],
    ],
    rows,
  };
}

export async function updateDocumentVerification(
  actorId: string,
  input: {
    documentId: string;
    status: "verified" | "needs_resubmission" | "rejected" | "pending";
    remarks: string;
  },
) {
  const db = requireSupabase();
  const { data: document, error: documentError } = await db
    .from("application_documents")
    .select("id, application_id")
    .eq("id", input.documentId)
    .single();

  if (documentError) throw documentError;

  const { error } = await db
    .from("application_documents")
    .update({
      verification_status: input.status,
      remarks: input.remarks,
      verified_by: actorId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", input.documentId);

  if (error) throw error;

  const { data: application, error: applicationError } = await db
    .from("applications")
    .select("vendor_id")
    .eq("id", document.application_id)
    .single();

  if (applicationError) throw applicationError;

  const { data: vendor, error: vendorError } = await db
    .from("vendors")
    .select("profile_id")
    .eq("id", application.vendor_id)
    .single();

  if (vendorError) throw vendorError;

  await notifyUser(
    vendor.profile_id,
    "Document verification updated",
    `Your uploaded document is now ${titleizeStatus(input.status)}.`,
    input.status,
    "/vendor/documents",
  );

  await logActivity(actorId, input.status, "application_document", input.documentId, {
    remarks: input.remarks,
  });
}

export async function fetchStalls(): Promise<{
  summary: [string, string][];
  rows: AdminStallRecord[];
}> {
  const core = await loadCoreMaps();

  const rows = core.stalls.map((item) => {
    const vendorId = item.vendor_id ?? null;
    const vendor = vendorId ? core.vendorById.get(vendorId) : null;
    const profile = vendor ? core.profileById.get(vendor.profile_id) : null;
    return {
      id: item.id,
      sectionId: item.section_id,
      section: core.sectionById.get(item.section_id)?.name ?? "Unassigned",
      stallNumber: item.stall_number,
      stall: `${core.sectionById.get(item.section_id)?.name ?? "Section"} ${item.stall_number}`,
      type: item.stall_type,
      rate: Number(item.monthly_rate ?? 0),
      status: titleizeStatus(item.status),
      notes: item.notes ?? "",
      currentVendorId: vendorId,
      currentVendorName: profile?.full_name ?? vendor?.business_name ?? null,
      currentVendorEmail: profile?.email ?? null,
      currentVendorPhone: profile?.phone ?? null,
    };
  });

  return {
    summary: [
      ["Total stalls", `${rows.length}`],
      ["Available", `${rows.filter((item) => item.status === "Available").length}`],
      ["Maintenance", `${rows.filter((item) => item.status === "Under Maintenance").length}`],
    ],
    rows,
  };
}

export async function saveStall(
  actorId: string,
  input: {
    stallId?: string;
    sectionId: string;
    stallNumber: string;
    stallType: string;
    monthlyRate: number;
    status: string;
    notes: string;
    vendorId?: string | null;
  },
) {
  const db = requireSupabase();
  const normalizedStatus = input.status.toLowerCase().replace(/\s+/g, "_");
  const payload: Record<string, unknown> = {
    section_id: input.sectionId,
    stall_number: input.stallNumber,
    stall_type: input.stallType,
    monthly_rate: input.monthlyRate,
    status: normalizedStatus,
    notes: input.notes,
  };
  // Set vendor_id when provided; clear it when stall is no longer occupied
  if (input.vendorId !== undefined) {
    payload.vendor_id = input.vendorId ?? null;
  } else if (normalizedStatus !== "occupied") {
    payload.vendor_id = null;
  }

  const result = input.stallId
    ? await db.from("stalls").update(payload).eq("id", input.stallId).select("id").single()
    : await db.from("stalls").insert(payload).select("id").single();

  if (result.error) throw result.error;
  await logActivity(actorId, input.stallId ? "updated" : "created", "stall", result.data.id, payload);
}

export async function deleteStall(actorId: string, stallId: string) {
  const db = requireSupabase();
  const { error } = await db.from("stalls").delete().eq("id", stallId);
  if (error) {
    if (error.code === "23503") {
      throw new Error("This stall is linked to existing records and cannot be deleted. Mark it inactive instead.");
    }
    throw error;
  }
  await logActivity(actorId, "deleted", "stall", stallId);
}

export async function fetchBillings(): Promise<{
  summary: [string, string][];
  rows: AdminBillingRecord[];
}> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const { data, error } = await db
    .from("billings")
    .select("id, vendor_id, billing_month, base_amount, amount_due, due_date, amount_paid, status, penalties, notes")
    .order("billing_month", { ascending: false });

  if (error) throw error;

  const stallByVendorId = new Map(
    core.stalls.filter((stall) => stall.vendor_id).map((stall) => [stall.vendor_id!, stall.id]),
  );

  const rows = (data ?? []).map((item) => {
    const vendor = item.vendor_id ? core.vendorById.get(item.vendor_id) : null;
    const profile = vendor ? core.profileById.get(vendor.profile_id) : null;
    const stallId = item.vendor_id ? stallByVendorId.get(item.vendor_id) : undefined;
    const stall = stallId ? core.stallById.get(stallId)?.label ?? "-" : "-";

    return {
      id: item.id,
      vendorId: item.vendor_id ?? "",
      vendorProfileId: vendor?.profile_id ?? "",
      vendor: profile?.full_name
        ? `${profile.full_name}${vendor?.business_name ? ` (${vendor.business_name})` : ""}`
        : vendor?.business_name ?? "Unknown vendor",
      stall,
      billingMonth: formatDate(item.billing_month),
      billingMonthIso: item.billing_month,
      baseAmount: Number(item.base_amount ?? 0),
      amountDue: Number(item.amount_due ?? 0),
      dueDate: formatDate(item.due_date),
      dueDateIso: item.due_date,
      amountPaid: Number(item.amount_paid ?? 0),
      status: titleizeStatus(item.status),
      penalties: Number(item.penalties ?? 0),
      notes: item.notes ?? "",
    };
  });

  const outstanding = rows.reduce((sum, item) => sum + Math.max(item.amountDue - item.amountPaid, 0), 0);

  return {
    summary: [
      ["Outstanding", formatCurrency(outstanding)],
      ["Partial", `${rows.filter((item) => item.status === "Partial").length} accounts`],
      ["Paid this month", formatCurrency(rows.reduce((sum, item) => sum + item.amountPaid, 0))],
    ],
    rows,
  };
}

export async function createBilling(
  actorId: string,
  input: {
    vendorId: string;
    billingMonth: string;
    dueDate: string;
    notes: string;
  },
) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("billings")
    .insert({
      vendor_id: input.vendorId,
      billing_month: input.billingMonth,
      base_amount: (await fetchVendorLeaseRates())[input.vendorId] ?? 0,
      due_date: input.dueDate,
      notes: input.notes,
      status: "unpaid",
    })
    .select("id")
    .single();

  if (error) throw error;
  await logActivity(actorId, "created", "billing", data.id, input);
}

export async function updateBilling(
  actorId: string,
  input: {
    billingId: string;
    billingMonth: string;
    dueDate: string;
    notes: string;
  },
) {
  const db = requireSupabase();
  const { error } = await db
    .from("billings")
    .update({
      billing_month: input.billingMonth,
      due_date: input.dueDate,
      notes: input.notes,
    })
    .eq("id", input.billingId);

  if (error) throw error;
  await logActivity(actorId, "updated", "billing", input.billingId, input);
}

export async function fetchPayments(): Promise<{
  summary: [string, string][];
  rows: AdminPaymentRecord[];
}> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const { data, error } = await db
    .from("payments")
    .select("id, billing_id, vendor_id, amount, payment_date, payment_method, receipt_number, internal_reference, verification_status, proof_path, payment_group_id, recorded_by, notes")
    .order("payment_date", { ascending: false });

  if (error) throw error;

  const rows = await Promise.all((data ?? []).map(async (item) => {
    const vendor = core.vendorById.get(item.vendor_id);
    const profile = vendor ? core.profileById.get(vendor.profile_id) : null;
    const recorder = item.recorded_by ? core.profileById.get(item.recorded_by) : null;
    return {
      id: item.id,
      billingId: item.billing_id,
      vendorId: item.vendor_id,
      vendorProfileId: vendor?.profile_id ?? "",
      vendor: profile?.full_name
        ? `${profile.full_name}${vendor?.business_name ? ` (${vendor.business_name})` : ""}`
        : vendor?.business_name ?? "Unknown vendor",
      amount: Number(item.amount ?? 0),
      paymentDate: formatDate(item.payment_date),
      paymentDateIso: item.payment_date,
      method: item.payment_method,
      receipt: item.receipt_number ?? "-",
      internalReference: item.internal_reference,
      verificationStatus: titleizeStatus(item.verification_status),
      proofPath: item.proof_path ?? null,
      proofUrl: item.proof_path
        ? (await db.storage.from("payment-proofs").createSignedUrl(item.proof_path, 300)).data?.signedUrl ?? null
        : null,
      paymentGroupId: item.payment_group_id,
      recordedBy: recorder?.full_name ?? "Vendor Portal",
      notes: item.notes ?? "",
    };
  }));

  return {
    summary: [
      ["Verified entries", `${rows.filter((item) => item.verificationStatus === "Verified").length}`],
      ["Cash", `${rows.filter((item) => item.method.toLowerCase() === "cash").length}`],
      ["Digital", `${rows.filter((item) => item.method.toLowerCase() !== "cash").length}`],
    ],
    rows,
  };
}

export async function createPayment(
  actorId: string,
  input: {
    billingId: string;
    amount: number;
    paymentDate: string;
    method: string;
    receiptNumber: string;
    notes: string;
  },
) {
  const db = requireSupabase();
  const { data: billing, error: billingError } = await db
    .from("billings")
    .select("id, vendor_id")
    .eq("id", input.billingId)
    .single();

  if (billingError) throw billingError;
  if (!billing) throw new Error("Billing record not found.");
  if (!billing.vendor_id) throw new Error("Billing record has no associated vendor.");

  const { data, error } = await db
    .from("payments")
    .insert({
      billing_id: input.billingId,
      vendor_id: billing.vendor_id,
      amount: input.amount,
      payment_date: input.paymentDate,
      payment_method: input.method,
      receipt_number: input.receiptNumber || null,
      recorded_by: actorId,
      notes: input.notes,
      submitted_by_vendor: false,
      verification_status: "verified",
      verified_by: actorId,
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  await logActivity(actorId, "recorded", "payment", data.id, {
    billingId: input.billingId,
    amount: input.amount,
  });
}

export async function reviewPayment(
  actorId: string,
  paymentGroupId: string,
  status: "verified" | "rejected",
  rejectionReason = "",
) {
  const db = requireSupabase();
  const { error } = await db
    .from("payments")
    .update({
      verification_status: status,
      verified_by: status === "verified" ? actorId : null,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      rejection_reason: status === "rejected" ? rejectionReason || "Rejected by finance" : null,
    })
    .eq("payment_group_id", paymentGroupId);
  if (error) throw error;
  await logActivity(actorId, status, "payment_group", paymentGroupId, { rejectionReason });
}

export async function fetchViolations(): Promise<{
  summary: [string, string][];
  rows: AdminViolationRecord[];
}> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const { data, error } = await db
    .from("violations")
    .select("id, vendor_id, stall_id, category, description, violation_date, penalty_amount, status, action_taken")
    .order("violation_date", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []).map((item) => {
    const vendor = core.vendorById.get(item.vendor_id);
    const profile = vendor ? core.profileById.get(vendor.profile_id) : null;
    return {
      id: item.id,
      vendorId: item.vendor_id,
      vendorProfileId: vendor?.profile_id ?? "",
      vendor: vendor?.business_name ?? profile?.full_name ?? "Unknown vendor",
      stallId: item.stall_id ?? undefined,
      stall: item.stall_id ? core.stallById.get(item.stall_id)?.label ?? "-" : "-",
      category: item.category,
      description: item.description,
      date: formatDate(item.violation_date),
      dateIso: item.violation_date,
      penalty: Number(item.penalty_amount ?? 0),
      action: item.action_taken ?? "",
      status: titleizeStatus(item.status),
    };
  });

  return {
    summary: [
      ["Open cases", `${rows.filter((item) => item.status === "Open").length}`],
      ["Penalty amount", formatCurrency(rows.reduce((sum, item) => sum + item.penalty, 0))],
      ["Repeat vendors", `${new Set(rows.map((item) => item.vendorId)).size}`],
    ],
    rows,
  };
}

export async function saveViolation(
  actorId: string,
  input: {
    violationId?: string;
    vendorId: string;
    stallId?: string;
    category: string;
    description: string;
    violationDate: string;
    penaltyAmount: number;
    actionTaken: string;
    status: string;
  },
) {
  const db = requireSupabase();
  const payload = {
    vendor_id: input.vendorId,
    stall_id: input.stallId || null,
    category: input.category,
    description: input.description,
    violation_date: input.violationDate,
    penalty_amount: input.penaltyAmount,
    action_taken: input.actionTaken,
    status: input.status.toLowerCase().replace(/\s+/g, "_"),
    recorded_by: actorId,
  };

  const result = input.violationId
    ? await db.from("violations").update(payload).eq("id", input.violationId).select("id").single()
    : await db.from("violations").insert(payload).select("id").single();

  if (result.error) throw result.error;
  await logActivity(actorId, input.violationId ? "updated" : "created", "violation", result.data.id, payload);
}

export async function deleteViolation(actorId: string, violationId: string) {
  const db = requireSupabase();
  const { error } = await db.from("violations").delete().eq("id", violationId);
  if (error) throw error;
  await logActivity(actorId, "deleted", "violation", violationId);
}

export async function fetchNotifications(): Promise<AdminNotificationRecord[]> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const { data, error } = await db
    .from("notifications")
    .select("id, user_id, title, message, type, is_read, link, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item) => {
    const profile = core.profileById.get(item.user_id);
    return {
      id: item.id,
      userId: item.user_id,
      recipient: profile ? `${profile.full_name} (${profile.email})` : "Unknown user",
      title: item.title,
      message: item.message,
      type: titleizeStatus(item.type),
      isRead: item.is_read,
      link: item.link ?? "",
      createdAt: formatDateTime(item.created_at),
      createdAtIso: item.created_at,
    };
  });
}

export async function createAdminNotification(
  actorId: string,
  input: {
    userId: string;
    title: string;
    message: string;
    type: string;
    link: string;
  },
) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("notifications")
    .insert({
      user_id: input.userId,
      title: input.title,
      message: input.message,
      type: input.type.toLowerCase().replace(/\s+/g, "_"),
      link: input.link,
    })
    .select("id")
    .single();

  if (error) throw error;
  await logActivity(actorId, "created", "notification", data.id, input);
}

export async function toggleAdminNotificationRead(notificationId: string, isRead: boolean) {
  const db = requireSupabase();
  const { error } = await db.from("notifications").update({ is_read: isRead }).eq("id", notificationId);
  if (error) throw error;
}

export async function deleteAdminNotification(notificationId: string) {
  const db = requireSupabase();
  const { error } = await db.from("notifications").delete().eq("id", notificationId);
  if (error) throw error;
}

export async function fetchStaff(): Promise<{
  summary: [string, string][];
  rows: AdminStaffRecord[];
}> {
  const db = requireSupabase();
  const core = await loadCoreMaps();
  const { data, error } = await db
    .from("staff")
    .select("id, profile_id, position_title, is_active")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []).map((item) => {
    const profile = core.profileById.get(item.profile_id);
    return {
      id: item.id,
      profileId: item.profile_id,
      name: profile?.full_name ?? "Unknown staff",
      role: titleizeStatus(profile?.role ?? "admin"),
      email: profile?.email ?? "-",
      positionTitle: item.position_title ?? "",
      isActive: item.is_active,
    };
  });

  return {
    summary: [
      ["Enabled accounts", `${rows.filter((item) => item.isActive).length}`],
      ["Super admins", `${rows.filter((item) => item.role === "Super Admin").length}`],
      ["Finance users", `${rows.filter((item) => item.role === "Finance").length}`],
    ],
    rows,
  };
}

export async function updateStaffRecord(
  actorId: string,
  input: {
    staffId: string;
    profileId: string;
    role: string;
    positionTitle: string;
    isActive: boolean;
  },
) {
  const db = requireSupabase();
  const { error: profileError } = await db
    .from("profiles")
    .update({ role: input.role.toLowerCase().replace(/\s+/g, "_") })
    .eq("id", input.profileId);

  if (profileError) throw profileError;

  const { error: staffError } = await db
    .from("staff")
    .update({ position_title: input.positionTitle, is_active: input.isActive })
    .eq("id", input.staffId);

  if (staffError) throw staffError;
  await logActivity(actorId, "updated", "staff", input.staffId, input);
}

export async function fetchSettings(): Promise<AdminSettingsSnapshot> {
  const db = requireSupabase();
  const [requirementsResult, settingsResult] = await Promise.all([
    db.from("document_requirements").select("id, code, name, description, is_required, has_expiry, sort_order").order("sort_order", { ascending: true }),
    db.from("system_settings").select("key, value"),
  ]);

  if (requirementsResult.error) throw requirementsResult.error;
  if (settingsResult.error) throw settingsResult.error;

  const settingsMap = new Map((settingsResult.data ?? []).map((item) => [item.key, item.value as Record<string, unknown>]));
  const billingSettings = settingsMap.get("billing_schedule") ?? {};
  const notificationTemplates = settingsMap.get("notification_templates") ?? {};
  const paymentSettings = settingsMap.get("payment_methods") ?? {};
  const pickupSettings = settingsMap.get("pickup_information") ?? {};

  return {
    documentRequirements: (requirementsResult.data ?? []).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      isRequired: item.is_required,
      hasExpiry: item.has_expiry,
      sortOrder: item.sort_order,
    })),
    billingSettings: {
      billingDay: Number(billingSettings.billingDay ?? 5),
      penaltyAmount: Number(billingSettings.penaltyAmount ?? 150),
      reminderDaysBefore: Number(billingSettings.reminderDaysBefore ?? 3),
    },
    notificationTemplates: {
      approval: String(notificationTemplates.approval ?? "Your application has been approved."),
      rejection: String(notificationTemplates.rejection ?? "Your application requires attention."),
      overdue: String(notificationTemplates.overdue ?? "Your billing account has passed the due date."),
    },
    paymentMethods: Array.isArray(paymentSettings.methods)
      ? paymentSettings.methods.map(String)
      : ["Cash", "GCash"],
    pickupInformation: {
      enabled: Boolean(pickupSettings.enabled ?? false),
      schedule: String(pickupSettings.schedule ?? ""),
      location: String(pickupSettings.location ?? ""),
      contact: String(pickupSettings.contact ?? ""),
      instructions: String(pickupSettings.instructions ?? ""),
    },
  };
}

export async function saveDocumentRequirement(
  actorId: string,
  input: {
    id: string;
    name: string;
    description: string;
    isRequired: boolean;
    hasExpiry: boolean;
    sortOrder: number;
  },
) {
  const db = requireSupabase();
  const { error } = await db
    .from("document_requirements")
    .update({
      name: input.name,
      description: input.description,
      is_required: input.isRequired,
      has_expiry: input.hasExpiry,
      sort_order: input.sortOrder,
    })
    .eq("id", input.id);

  if (error) throw error;
  await logActivity(actorId, "updated", "document_requirement", input.id, input);
}

export async function saveSystemSetting(
  actorId: string,
  key: string,
  value: Record<string, unknown>,
) {
  const db = requireSupabase();
  const { error } = await db
    .from("system_settings")
    .upsert({ key, value, updated_by: actorId, updated_at: new Date().toISOString() });

  if (error) throw error;
  await logActivity(actorId, "updated", "system_setting", key, value);
}

export async function fetchReports(filters: ReportFiltersInput): Promise<AdminReportsSnapshot> {
  const [payments, billings, stalls] = await Promise.all([fetchPayments(), fetchBillings(), fetchStalls()]);
  const billingById = new Map(billings.rows.map((item) => [item.id, item]));
  const stallByVendor = new Map(stalls.rows.filter((item) => item.currentVendorId).map((item) => [item.currentVendorId!, item]));
  const nameNeedle = filters.vendorName.trim().toLowerCase();
  const filteredPayments = payments.rows.filter((item) => {
    const date = new Date(`${item.paymentDateIso}T00:00:00`);
    const stall = stallByVendor.get(item.vendorId);
    return (filters.month === "All months" || date.getMonth() + 1 === Number(filters.month))
      && (filters.year === "All years" || date.getFullYear() === Number(filters.year))
      && (filters.section === "All blocks" || stall?.section === filters.section)
      && (!filters.stallNumber.trim() || stall?.stallNumber.toLowerCase().includes(filters.stallNumber.trim().toLowerCase()))
      && (!nameNeedle || item.vendor.toLowerCase().includes(nameNeedle))
      && (filters.paymentStatus === "Any status" || item.verificationStatus === filters.paymentStatus);
  });
  const verifiedTotal = filteredPayments
    .filter((item) => item.verificationStatus === "Verified")
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    summary: [
      {
        label: "Verified collections",
        value: formatCurrency(verifiedTotal),
        note: `${filteredPayments.filter((item) => item.verificationStatus === "Verified").length} verified entries`,
      },
      {
        label: "Pending review",
        value: `${filteredPayments.filter((item) => item.verificationStatus === "Pending").length}`,
        note: "Vendor submissions awaiting finance review",
      },
      {
        label: "Payment records",
        value: `${filteredPayments.length}`,
        note: `Filtered by ${filters.section}`,
      },
    ],
    rows: filteredPayments.map((item) => {
      const billing = billingById.get(item.billingId);
      const stall = stallByVendor.get(item.vendorId);
      return {
        payment_reference: item.internalReference,
        payment_date: item.paymentDate,
        billing_month: billing?.billingMonth ?? "-",
        vendor: item.vendor,
        block: stall?.section ?? "-",
        stall: stall?.stallNumber ?? "-",
        amount: formatCurrency(item.amount),
        method: item.method,
        external_reference: item.receipt,
        verification_status: item.verificationStatus,
      };
    }),
  };
}
