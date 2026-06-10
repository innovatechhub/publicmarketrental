import { supabase } from "@/integrations/supabase/client";

export type VendorApplicationStatusLabel =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Assigned"
  | "Needs Resubmission"
  | "Rejected";

export type VendorDocumentStatusLabel =
  | "Pending"
  | "Verified"
  | "Needs Resubmission"
  | "Rejected";

export type VendorBillingStatusLabel = "Paid" | "Partial" | "Unpaid" | "Overdue";
export type VendorSupportStatusLabel = "Open" | "In Review" | "Resolved";

export interface VendorApplicationRecord {
  id: string;
  businessType: string;
  preferredSection: string;
  preferredStallType: string;
  notes: string;
  status: VendorApplicationStatusLabel;
  preferredStallLabel: string;
  submittedAt?: string;
  updatedAt: string;
  adminRemarks?: string;
}

export interface VendorDocumentRecord {
  id: string;
  applicationId: string;
  document: string;
  uploaded: string;
  expiry: string;
  status: VendorDocumentStatusLabel;
  remarks: string;
  fileUrl?: string;
  fileName?: string;
}

export interface VendorBillingRecord {
  id: string;
  billingMonth: string;
  amountDue: number;
  dueDate: string;
  amountPaid: number;
  status: VendorBillingStatusLabel;
  paymentDate?: string;
  paymentMethod?: string;
  reference?: string;
}

export interface VendorNotificationRecord {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  status: string;
  read: boolean;
}

export interface VendorSupportRequestRecord {
  id: string;
  subject: string;
  detail: string;
  requestedAt: string;
  status: VendorSupportStatusLabel;
}

export interface VendorStallInfo {
  stall: string;
  section: string;
  type: string;
  rate: string;
  leaseStart: string;
  leaseEnd: string;
  notes: string;
  renewalStatus: "Not Requested" | "Pending Renewal Review";
  renewalRequestedAt?: string;
  supportRequests: { id: string; subject: string; detail: string; requestedAt: string; status: string }[];
}

export interface VendorWorkspaceSnapshot {
  applications: VendorApplicationRecord[];
  documents: VendorDocumentRecord[];
  billings: VendorBillingRecord[];
  notifications: VendorNotificationRecord[];
  stall: VendorStallInfo;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

function formatDisplayDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function toIsoDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function mapApplicationStatus(status: string | null): VendorApplicationStatusLabel {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under Review";
    case "approved":
      return "Approved";
    case "needs_resubmission":
      return "Needs Resubmission";
    case "assigned":
    case "active":
      return "Assigned";
    case "rejected":
      return "Rejected";
    default:
      return "Draft";
  }
}

function mapDocumentStatus(status: string | null): VendorDocumentStatusLabel {
  switch (status) {
    case "verified":
      return "Verified";
    case "needs_resubmission":
      return "Needs Resubmission";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

function mapBillingStatus(status: string | null): VendorBillingStatusLabel {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "overdue":
      return "Overdue";
    default:
      return "Unpaid";
  }
}

function mapSupportStatus(status: string | null): VendorSupportStatusLabel {
  switch (status) {
    case "resolved":
      return "Resolved";
    case "in_review":
      return "In Review";
    default:
      return "Open";
  }
}

async function getVendor(profileId: string) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("vendors")
    .select("id, business_name")
    .eq("profile_id", profileId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createNotification(profileId: string, title: string, detail: string, status: string, link: string) {
  const db = requireSupabase();
  const { error } = await db.from("notifications").insert({
    user_id: profileId,
    title,
    message: detail,
    type: status,
    link,
  });

  if (error) {
    throw error;
  }
}

export async function fetchVendorWorkspace(profileId: string): Promise<VendorWorkspaceSnapshot> {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);

  const [applicationsResult, notificationsResult, supportResult] = await Promise.all([
    db
      .from("applications")
      .select("id, preferred_stall_id, business_type, preferred_section, preferred_stall_type, status, submitted_at, updated_at, rejection_reason, remarks")
      .eq("vendor_id", vendor.id)
      .order("updated_at", { ascending: false }),
    db
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false }),
    db
      .from("stall_support_requests")
      .select("id, subject, detail, status, created_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false }),
  ]);

  if (applicationsResult.error) throw applicationsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;
  if (supportResult.error) throw supportResult.error;

  const applications = applicationsResult.data ?? [];
  const preferredStallIds = applications
    .map((item) => item.preferred_stall_id)
    .filter((item): item is string => Boolean(item));
  const activeStallIds: string[] = [];
  const allStallIds = [...new Set([...preferredStallIds, ...activeStallIds])];

  const [stallsResult, requirementsResult, documentsResult, paymentsResult] = await Promise.all([
    allStallIds.length > 0
      ? db
          .from("stalls")
          .select("id, stall_number, stall_type, monthly_rate, notes, section_id")
          .in("id", allStallIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("document_requirements").select("id, name, sort_order"),
    applications.length > 0
      ? db
          .from("application_documents")
          .select("id, application_id, requirement_id, file_name, file_url, verification_status, remarks, expiry_date, created_at")
          .in("application_id", applications.map((item) => item.id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
      db
          .from("payments")
          .select("billing_id, payment_date, payment_method, receipt_number")
          .eq("vendor_id", vendor.id)
  ]);

  if (stallsResult.error) throw stallsResult.error;
  if (requirementsResult.error) throw requirementsResult.error;
  if (documentsResult.error) throw documentsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const sectionIds = [...new Set((stallsResult.data ?? []).map((item) => item.section_id))];
  const [sectionsResult, billingsResult] = await Promise.all([
    sectionIds.length > 0
      ? db.from("market_sections").select("id, name").in("id", sectionIds)
      : Promise.resolve({ data: [], error: null }),
      db
          .from("billings")
          .select("id, billing_month, amount_due, amount_paid, due_date, status")
          .order("billing_month", { ascending: false })
  ]);

  if (sectionsResult.error) throw sectionsResult.error;
  if (billingsResult.error) throw billingsResult.error;

  const sectionsById = new Map((sectionsResult.data ?? []).map((item) => [item.id, item.name]));
  const stallsById = new Map(
    (stallsResult.data ?? []).map((item) => [
      item.id,
      {
        ...item,
        sectionName: sectionsById.get(item.section_id) ?? "Unassigned",
      },
    ]),
  );
  const requirementsById = new Map((requirementsResult.data ?? []).map((item) => [item.id, item.name]));
  const latestPaymentsByBilling = new Map(
    (paymentsResult.data ?? []).map((item) => [item.billing_id, item]),
  );

  const mappedApplications: VendorApplicationRecord[] = applications.map((item) => {
    const preferredStall = item.preferred_stall_id ? stallsById.get(item.preferred_stall_id) : null;

    return {
      id: item.id,
      businessType: item.business_type ?? "",
      preferredSection: item.preferred_section ?? preferredStall?.sectionName ?? "",
      preferredStallType: item.preferred_stall_type ?? preferredStall?.stall_type ?? "",
      notes: item.remarks ?? "",
      status: mapApplicationStatus(item.status),
      preferredStallLabel: preferredStall
        ? `${preferredStall.sectionName} ${preferredStall.stall_number}`
        : item.preferred_section && item.preferred_stall_type
          ? `${item.preferred_section} - ${item.preferred_stall_type}`
          : "Pending stall assignment",
      submittedAt: item.submitted_at ? formatDisplayDate(item.submitted_at) : undefined,
      updatedAt: formatDisplayDate(item.updated_at),
      adminRemarks: item.rejection_reason ?? undefined,
    };
  });

  // Generate signed URLs for documents that have real storage paths
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
      // bucket may not be provisioned yet — degrade gracefully
    }
  }

  const mappedDocuments: VendorDocumentRecord[] = (documentsResult.data ?? []).map((item) => ({
    id: item.id,
    applicationId: item.application_id,
    document: requirementsById.get(item.requirement_id) ?? item.file_name,
    uploaded: formatDisplayDate(item.created_at),
    expiry: item.expiry_date ? formatDisplayDate(item.expiry_date) : "-",
    status: mapDocumentStatus(item.verification_status),
    remarks: item.remarks ?? "",
    fileUrl: item.file_url ? (signedUrlMap.get(item.file_url) ?? undefined) : undefined,
    fileName: item.file_name ?? undefined,
  }));

  const mappedBillings: VendorBillingRecord[] = (billingsResult.data ?? []).map((item) => {
    const latestPayment = latestPaymentsByBilling.get(item.id);

    return {
      id: item.id,
      billingMonth: formatMonthLabel(item.billing_month),
      amountDue: Number(item.amount_due ?? 0),
      dueDate: formatDisplayDate(item.due_date),
      amountPaid: Number(item.amount_paid ?? 0),
      status: mapBillingStatus(item.status),
      paymentDate: latestPayment?.payment_date ? formatDisplayDate(latestPayment.payment_date) : undefined,
      paymentMethod: latestPayment?.payment_method ?? undefined,
      reference: latestPayment?.receipt_number ?? undefined,
    };
  });

  const mappedNotifications: VendorNotificationRecord[] = (notificationsResult.data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    detail: item.message,
    timestamp: formatDisplayDate(item.created_at),
    status: item.type
      .split("_")
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    read: item.is_read,
  }));

  const mappedSupportRequests = (supportResult.data ?? []).map((item) => ({
    id: item.id,
    subject: item.subject,
    detail: item.detail,
    requestedAt: formatDisplayDate(item.created_at),
    status: mapSupportStatus(item.status),
  }));

  return {
    applications: mappedApplications,
    documents: mappedDocuments,
    billings: mappedBillings,
    notifications: mappedNotifications,
    stall: {
      stall: "No stall assigned",
      section: "-",
      type: "-",
      rate: "-",
      leaseStart: "-",
      leaseEnd: "-",
      notes: "-",
      renewalStatus: "Not Requested" as const,
      supportRequests: mappedSupportRequests,
    },
  };
}

export async function requestVendorLeaseRenewal(profileId: string): Promise<void> {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);
  const { error } = await db.from("stall_support_requests").insert({
    vendor_id: vendor.id,
    subject: "Lease Renewal Request",
    detail: "Vendor has requested lease renewal.",
    status: "open",
  });
  if (error) throw error;
}

export async function saveVendorApplication(
  profileId: string,
  input: { businessType: string; preferredSection: string; preferredStallType: string; notes: string },
  applicationId?: string,
) {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);
  const payload = {
    vendor_id: vendor.id,
    application_type: "online",
    business_type: input.businessType,
    preferred_section: input.preferredSection,
    preferred_stall_type: input.preferredStallType,
    remarks: input.notes,
  };

  if (applicationId) {
    const { data, error } = await db
      .from("applications")
      .update(payload)
      .eq("id", applicationId)
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  const { data, error } = await db.from("applications").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function submitVendorApplication(
  profileId: string,
  input: { businessType: string; preferredSection: string; preferredStallType: string; notes: string },
  applicationId?: string,
) {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);
  const payload = {
    vendor_id: vendor.id,
    application_type: "online",
    business_type: input.businessType,
    preferred_section: input.preferredSection,
    preferred_stall_type: input.preferredStallType,
    remarks: input.notes,
    status: "submitted",
    submitted_at: new Date().toISOString(),
  };

  const id = applicationId
    ? (
        await db
          .from("applications")
          .update(payload)
          .eq("id", applicationId)
          .select("id")
          .single()
      ).data?.id
    : (
        await db.from("applications").insert(payload).select("id").single()
      ).data?.id;

  if (!id) {
    throw new Error("Unable to submit the application.");
  }

  await createNotification(
    profileId,
    "Application submitted",
    "Your stall request has been sent for review.",
    "submitted",
    "/vendor/applications",
  );

  return id;
}

export async function deleteVendorApplication(profileId: string, applicationId: string) {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);
  const { error } = await db
    .from("applications")
    .delete()
    .eq("id", applicationId)
    .eq("vendor_id", vendor.id);

  if (error) throw error;
}

export async function saveVendorDocument(
  profileId: string,
  input: { document: string; expiry: string; remarks: string; file?: File | null; applicationId?: string },
  documentId?: string,
) {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);
  const { data: requirement, error: requirementError } = await db
    .from("document_requirements")
    .select("id")
    .eq("name", input.document)
    .single();

  if (requirementError) throw requirementError;

  let applicationId: string | null = input.applicationId ?? null;
  let existingFileUrl: string | null = null;
  let existingFileName: string | null = null;

  if (documentId) {
    const { data: existingDoc, error: existingDocError } = await db
      .from("application_documents")
      .select("application_id, file_url, file_name")
      .eq("id", documentId)
      .single();

    if (existingDocError) throw existingDocError;
    applicationId = existingDoc.application_id;
    existingFileUrl = existingDoc.file_url;
    existingFileName = existingDoc.file_name;
  } else if (!applicationId) {
    const { data: latestApplication, error: latestApplicationError } = await db
      .from("applications")
      .select("id")
      .eq("vendor_id", vendor.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (latestApplicationError) throw latestApplicationError;
    applicationId = latestApplication?.[0]?.id ?? null;
  }

  if (!applicationId) {
    throw new Error("Save the application as a draft first before uploading documents.");
  }

  // Upload file to Supabase Storage if a new file was provided
  let fileUrl = existingFileUrl ?? null;
  let fileName = existingFileName ?? input.document;
  let fileUploadWarning: string | null = null;

  if (input.file) {
    const ext = input.file.name.split(".").pop() ?? "bin";
    const storagePath = `${profileId}/${Date.now()}-${input.document.replace(/\s+/g, "-").toLowerCase()}.${ext}`;

    const { error: uploadError } = await db.storage
      .from("vendor-documents")
      .upload(storagePath, input.file, { upsert: true, contentType: input.file.type });

    if (uploadError) {
      // Degrade gracefully — save the record without the file rather than blocking the whole save
      fileUploadWarning = uploadError.message;
    } else {
      fileUrl = storagePath;
      fileName = input.file.name;
    }
  }

  const payload = {
    application_id: applicationId,
    requirement_id: requirement.id,
    file_url: fileUrl,
    file_name: fileName,
    verification_status: "pending",
    remarks: input.remarks,
    expiry_date: toIsoDate(input.expiry),
  };

  const id = documentId
    ? (
        await db
          .from("application_documents")
          .update(payload)
          .eq("id", documentId)
          .select("id")
          .single()
      ).data?.id
    : (
        await db.from("application_documents").upsert(payload).select("id").single()
      ).data?.id;

  if (!id) {
    throw new Error("Unable to save document.");
  }

  await createNotification(
    profileId,
    "Document uploaded",
    `${input.document} is now pending verification.`,
    "pending",
    "/vendor/documents",
  );

  return { id, fileUploadWarning };
}

export async function deleteVendorDocument(documentId: string) {
  const db = requireSupabase();
  const { error } = await db.from("application_documents").delete().eq("id", documentId);
  if (error) throw error;
}

export async function recordVendorPayment(
  profileId: string,
  input: { billingId: string; amount: number; method: string; reference?: string },
) {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);
  const { error } = await db.from("payments").insert({
    billing_id: input.billingId,
    vendor_id: vendor.id,
    amount: input.amount,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: input.method,
    receipt_number: input.reference ?? null,
    submitted_by_vendor: true,
    notes: "Submitted from vendor portal",
  });

  if (error) throw error;

  await createNotification(
    profileId,
    "Payment logged",
    "Your payment entry has been recorded in the billing ledger.",
    "paid",
    "/vendor/billing",
  );
}

export async function submitVendorSupportRequest(
  profileId: string,
  input: { subject: string; detail: string },
) {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);

  const { error } = await db.from("stall_support_requests").insert({
    vendor_id: vendor.id,
    stall_id: null,
    subject: input.subject,
    detail: input.detail,
  });

  if (error) throw error;

  await createNotification(
    profileId,
    "Support request submitted",
    `${input.subject} has been sent to the operations team.`,
    "open",
    "/vendor/stall",
  );
}

export async function markAllVendorNotificationsRead(profileId: string) {
  const db = requireSupabase();
  const { error } = await db.from("notifications").update({ is_read: true }).eq("user_id", profileId);
  if (error) throw error;
}

export async function toggleVendorNotificationRead(profileId: string, notificationId: string, read: boolean) {
  const db = requireSupabase();
  const { error } = await db
    .from("notifications")
    .update({ is_read: read })
    .eq("id", notificationId)
    .eq("user_id", profileId);
  if (error) throw error;
}

export async function deleteVendorNotification(profileId: string, notificationId: string) {
  const db = requireSupabase();
  const { error } = await db
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", profileId);
  if (error) throw error;
}
