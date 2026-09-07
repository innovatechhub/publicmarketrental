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
  paymentMethods: string[];
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
    .select("id, business_name, profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data;
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("full_name, role")
    .eq("id", profileId)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (profile.role !== "vendor") {
    throw new Error("Vendor account not found for this profile.");
  }

  const { data: createdVendor, error: createError } = await db
    .from("vendors")
    .insert({
      profile_id: profileId,
      business_name: profile.full_name || "New Vendor",
      status: "active",
    })
    .select("id, business_name, profile_id")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      const { data: retryVendor, error: retryError } = await db
        .from("vendors")
        .select("id, business_name, profile_id")
        .eq("profile_id", profileId)
        .single();

      if (retryError) {
        throw new Error(retryError.message);
      }

      return retryVendor;
    }

    throw new Error(createError.message);
  }

  return createdVendor;
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
    throw new Error(error.message);
  }
}

export async function fetchVendorWorkspace(profileId: string): Promise<VendorWorkspaceSnapshot> {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);

  const [applicationsResult, notificationsResult, supportResult, leasesResult, paymentSettingsResult] = await Promise.all([
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
    db
      .from("leases")
      .select("id, vendor_id, stall_id, start_date, end_date, monthly_rate, status, renewal_status, created_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false }),
    db.from("system_settings").select("value").eq("key", "payment_methods").maybeSingle(),
  ]);

  if (applicationsResult.error) throw applicationsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;
  if (supportResult.error) throw supportResult.error;
  if (leasesResult.error) throw leasesResult.error;
  if (paymentSettingsResult.error) throw paymentSettingsResult.error;

  const applications = applicationsResult.data ?? [];
  const leases = leasesResult.data ?? [];
  const preferredStallIds = applications
    .map((item) => item.preferred_stall_id)
    .filter((item): item is string => Boolean(item));
  const leaseStallIds = leases.map((item) => item.stall_id).filter((item): item is string => Boolean(item));
  const assignedApplication = applications.find((item) => item.status === "assigned" || item.status === "active") ?? null;
  const allStallIds = [...new Set([...preferredStallIds, ...leaseStallIds])];

  const [stallsResult, requirementsResult, documentsResult, paymentsResult, billingsResult] = await Promise.all([
    allStallIds.length > 0
      ? db
          .from("stalls")
          .select("id, stall_number, stall_type, monthly_rate, notes, section_id, status")
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
      .eq("verification_status", "verified"),
    db
      .from("billings")
      .select("id, lease_id, billing_month, amount_due, amount_paid, due_date, status")
      .order("billing_month", { ascending: false }),
  ]);

  if (stallsResult.error) throw stallsResult.error;
  if (requirementsResult.error) throw requirementsResult.error;
  if (documentsResult.error) throw documentsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (billingsResult.error) throw billingsResult.error;

  type StallRow = {
    id: string;
    stall_number: string;
    stall_type: string;
    monthly_rate: number | null;
    notes: string | null;
    section_id: string;
    status: string;
  };
  type SectionRow = { id: string; name: string };
  type RequirementRow = { id: string; name: string; sort_order: number };
  type PaymentRow = { billing_id: string; payment_date: string; payment_method: string; receipt_number: string | null };
  type BillingRow = {
    id: string;
    lease_id: string;
    billing_month: string;
    amount_due: number | null;
    amount_paid: number | null;
    due_date: string;
    status: string;
  };
  type DocumentRow = {
    id: string;
    application_id: string;
    requirement_id: string;
    file_name: string;
    file_url: string;
    verification_status: string;
    remarks: string | null;
    expiry_date: string | null;
    created_at: string;
  };

  const stalls = (stallsResult.data ?? []) as StallRow[];
  const requirements = (requirementsResult.data ?? []) as RequirementRow[];
  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  const billings = (billingsResult.data ?? []) as BillingRow[];

  const currentLease = leases.find((item) => item.status === "active") ?? leases[0] ?? null;
  const sectionIds = [...new Set(stalls.map((item) => item.section_id))];
  const sectionsResult = sectionIds.length > 0
    ? await db.from("market_sections").select("id, name").in("id", sectionIds)
    : { data: [] as SectionRow[], error: null };

  if (sectionsResult.error) throw sectionsResult.error;

  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const sectionsById = new Map(sections.map((item) => [item.id, item.name]));
  const stallsById = new Map(
    stalls.map((item) => [
      item.id,
      {
        ...item,
        sectionName: sectionsById.get(item.section_id) ?? "Unassigned",
      },
    ]),
  );
  const requirementsById = new Map(requirements.map((item) => [item.id, item.name]));
  const latestPaymentsByBilling = new Map(payments.map((item) => [item.billing_id, item]));
  const stallId = currentLease?.stall_id ?? assignedApplication?.preferred_stall_id ?? null;
  const currentStall = stallId ? stallsById.get(stallId) : null;
  const renewalStatus = currentLease
    ? ["due_soon", "in_progress"].includes(currentLease.renewal_status)
      ? "Pending Renewal Review"
      : "Not Requested"
    : "Not Requested";

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
  const storagePaths = documents
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

  const mappedDocuments: VendorDocumentRecord[] = documents.map((item) => ({
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

  const mappedBillings: VendorBillingRecord[] = billings.map((item) => {
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
    paymentMethods: Array.isArray((paymentSettingsResult.data?.value as { methods?: unknown[] } | null)?.methods)
      ? ((paymentSettingsResult.data?.value as { methods: unknown[] }).methods.map(String))
      : ["Cash", "GCash"],
    stall: {
      stall: currentStall ? `${currentStall.sectionName} ${currentStall.stall_number}` : "No stall assigned",
      section: currentStall?.sectionName ?? "-",
      type: currentStall?.stall_type ?? "-",
      rate: currentStall ? formatCurrency(Number(currentStall.monthly_rate ?? 0)) : "-",
      leaseStart: currentLease ? formatDisplayDate(currentLease.start_date) : "-",
      leaseEnd: currentLease ? formatDisplayDate(currentLease.end_date) : "-",
      notes: "No active lease notes available.",
      renewalStatus: renewalStatus as "Not Requested" | "Pending Renewal Review",
      renewalRequestedAt: currentLease?.created_at ? formatDisplayDate(currentLease.created_at) : undefined,
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
  if (error) throw new Error(error.message);
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

    if (error) throw new Error(error.message);
    return data.id;
  }

  const { data, error } = await db.from("applications").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
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

  if (error) throw new Error(error.message);
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

  if (requirementError) throw new Error(requirementError.message);

  let applicationId: string | null = input.applicationId ?? null;
  let existingFileUrl: string | null = null;
  let existingFileName: string | null = null;

  if (documentId) {
    const { data: existingDoc, error: existingDocError } = await db
      .from("application_documents")
      .select("application_id, file_url, file_name")
      .eq("id", documentId)
      .single();

    if (existingDocError) throw new Error(existingDocError.message);
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

    if (latestApplicationError) throw new Error(latestApplicationError.message);
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
      throw new Error(`File upload failed: ${uploadError.message}`);
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
    expiry_date: input.expiry ? toIsoDate(input.expiry) : null,
  };

  let id: string | undefined;
  if (documentId) {
    const { data, error } = await db
      .from("application_documents")
      .update(payload)
      .eq("id", documentId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data?.id;
  } else {
    const { data, error } = await db
      .from("application_documents")
      .upsert(payload, { onConflict: "application_id,requirement_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data?.id;
  }

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
  if (error) throw new Error(error.message);
}

export async function recordVendorPayment(
  profileId: string,
  input: { billingId: string; amount: number; method: string; reference?: string; proof?: File | null; advanceMonths?: number },
) {
  const db = requireSupabase();
  const vendor = await getVendor(profileId);
  const advanceMonths = Math.max(1, Math.min(input.advanceMonths ?? 1, 12));
  const isGcash = input.method.toLowerCase() === "gcash";
  if (isGcash && !input.reference?.trim()) throw new Error("GCash reference number is required.");
  if (isGcash && !input.proof) throw new Error("Proof of payment is required for GCash.");

  const groupId = crypto.randomUUID();
  let proofPath: string | null = null;
  if (input.proof) {
    const extension = input.proof.name.split(".").pop()?.toLowerCase() || "bin";
    proofPath = `${profileId}/${groupId}/proof.${extension}`;
    const { error: uploadError } = await db.storage
      .from("payment-proofs")
      .upload(proofPath, input.proof, { contentType: input.proof.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
  }

  let allocations: Array<{ billing_id: string; remaining: number }> = [{ billing_id: input.billingId, remaining: input.amount }];
  if (advanceMonths > 1) {
    const { data, error: prepareError } = await db.rpc("prepare_vendor_advance_billings", {
      start_billing_id: input.billingId,
      month_count: advanceMonths,
    });
    if (prepareError) throw new Error(prepareError.message);
    allocations = ((data ?? []) as Array<{ billing_id: string; remaining: number }>).filter((item) => Number(item.remaining) > 0);
  }

  const { error } = await db.from("payments").insert(allocations.map((allocation) => ({
    billing_id: allocation.billing_id,
    vendor_id: vendor.id,
    amount: advanceMonths > 1 ? Number(allocation.remaining) : input.amount,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: input.method,
    receipt_number: input.reference?.trim() || null,
    proof_path: proofPath,
    payment_group_id: groupId,
    verification_status: "pending",
    submitted_by_vendor: true,
    notes: advanceMonths > 1 ? `Vendor advance payment covering ${advanceMonths} months` : "Submitted from vendor portal",
  })));

  if (error) {
    if (proofPath) await db.storage.from("payment-proofs").remove([proofPath]);
    throw new Error(error.message);
  }

  await createNotification(
    profileId,
    "Payment submitted",
    "Your payment is awaiting verification by the finance team.",
    "pending",
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

  if (error) throw new Error(error.message);

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
  if (error) throw new Error(error.message);
}

export async function toggleVendorNotificationRead(profileId: string, notificationId: string, read: boolean) {
  const db = requireSupabase();
  const { error } = await db
    .from("notifications")
    .update({ is_read: read })
    .eq("id", notificationId)
    .eq("user_id", profileId);
  if (error) throw new Error(error.message);
}

export async function deleteVendorNotification(profileId: string, notificationId: string) {
  const db = requireSupabase();
  const { error } = await db
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", profileId);
  if (error) throw new Error(error.message);
}
