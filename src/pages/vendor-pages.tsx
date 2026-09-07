import { useEffect, useMemo, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import {
  BellRing,
  CreditCard,
  FilePlus2,
  PencilLine,
  Printer,
  RefreshCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import {
  defaultApplicationValues,
  StallApplicationForm,
  type ApplicationValues,
} from "@/features/applications/stall-application-form";
import {
  formatCurrency,
  useVendorWorkspace,
  type VendorApplication,
  type VendorBillingRecord,
  type VendorDocumentRecord,
} from "@/features/vendor/vendor-workspace-context";
import type { MetricCardData } from "@/types/domain";

ChartJS.register(
  ArcElement,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const profileSchema = z.object({
  name: z.string().min(3, "Full name is required."),
  phone: z.string().min(7, "Phone number is required."),
  businessName: z.string().min(2, "Business name is required."),
});

const emailChangeSchema = z.object({
  email: z.string().email("Provide a valid email address."),
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(8, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const ACCEPTED_DOC_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE_MB = 10;
const REQUIRED_DOC_TYPES = [
  "Barangay Clearance",
  "Police Clearance",
  "Health Clearance",
  "DTI Registration",
  "Business Permit",
];

const paymentSchema = z.object({
  amount: z
    .string()
    .min(1, "Enter a payment amount.")
    .refine((value) => Number(value) > 0, "Enter a payment amount."),
  method: z.string().min(2, "Payment method is required."),
  reference: z.string().optional(),
  advanceMonths: z.string().min(1),
});

const supportRequestSchema = z.object({
  subject: z.string().min(3, "Issue subject is required."),
  detail: z.string().min(10, "Provide enough detail for the support request."),
});

type ProfileValues = z.infer<typeof profileSchema>;
type EmailChangeValues = z.infer<typeof emailChangeSchema>;
type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
type PaymentValues = z.infer<typeof paymentSchema>;
type SupportRequestValues = z.infer<typeof supportRequestSchema>;

export function VendorDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isReady, applications, billings, documents, notifications } = useVendorWorkspace();

  const orderedBillings = useMemo(
    () => [...billings].sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()),
    [billings],
  );
  const currentBalance = billings.reduce(
    (sum, item) => sum + Math.max(item.amountDue - item.amountPaid, 0),
    0,
  );
  const nextDueBilling = orderedBillings.find((item) => item.amountPaid < item.amountDue);
  const lastPaidBilling = [...billings]
    .filter((item) => item.amountPaid > 0)
    .sort((left, right) => new Date(right.paymentDate ?? right.dueDate).getTime() - new Date(left.paymentDate ?? left.dueDate).getTime())[0];

  if (!isReady) {
    return <LoadingCard message="Loading vendor workspace..." />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            {user?.businessName ?? "Vendor Account"}
          </p>
          <h2 className="mt-2 text-2xl font-bold uppercase tracking-[0.08em] text-[#00966f]">
            My Stall Information
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/vendor/applications")} variant="secondary">
            <FilePlus2 className="mr-2 h-4 w-4" />
            Applications
          </Button>
        </div>
      </div>

        <Card className="border-l-4 border-l-[#294cc2]">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-slate-500">Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-slate-500">Current Status</p>
              <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#00966f]">
                {currentBalance > 0 ? "Balance Due" : "Paid"}
              </span>
            </div>
            <PlainInfo
              label="Last Payment"
              value={lastPaidBilling?.paymentDate ?? lastPaidBilling?.billingMonth ?? "-"}
            />
            <PlainInfo label="Next Due Date" value={nextDueBilling?.dueDate ?? "-"} />
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide text-[#00966f]">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <PlainInfo label="Email" value={user?.email ?? "-"} />
          <PlainInfo label="Phone" value={user?.phone ?? "-"} />
        </CardContent>
      </Card>

      {notifications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg uppercase tracking-wide text-[#00966f]">Latest Notices</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {notifications.slice(0, 3).map((item) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4" key={item.id}>
                <p className="font-bold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function VendorProfilePage() {
  const { changeEmail, changePassword, user } = useAuth();
  const { applications, documents, saveProfile } = useVendorWorkspace();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      businessName: user?.businessName ?? "",
    },
  });

  const emailForm = useForm<EmailChangeValues>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: {
      email: user?.email ?? "",
    },
  });

  const passwordForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    form.reset({
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      businessName: user?.businessName ?? "",
    });
    emailForm.reset({
      email: user?.email ?? "",
    });
  }, [emailForm, form, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    await saveProfile(values);
    toast.success("Vendor profile updated.");
  });

  const onEmailSubmit = emailForm.handleSubmit(async (values) => {
    await changeEmail(values.email);
    toast.success("Email updated. You may need to confirm this change in your inbox.");
  });

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    await changePassword(values.currentPassword, values.newPassword);
    passwordForm.reset();
    toast.success("Password updated.");
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description="Maintain your contact details and business identity for applications, billing, and document verification."
        eyebrow="Vendor profile"
        title="Profile details"
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>These details are used across your vendor-side transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup label="Full name">
                  <Input {...form.register("name")} />
                  <FieldError message={form.formState.errors.name?.message} />
                </FieldGroup>
                <FieldGroup label="Phone">
                  <Input {...form.register("phone")} />
                  <FieldError message={form.formState.errors.phone?.message} />
                </FieldGroup>
                <FieldGroup label="Business name">
                  <Input {...form.register("businessName")} />
                  <FieldError message={form.formState.errors.businessName?.message} />
                </FieldGroup>
              </div>

              <Button disabled={form.formState.isSubmitting} type="submit">
                Save profile changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account security</CardTitle>
            <CardDescription>Update your sign-in email and password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <form className="space-y-4" onSubmit={onEmailSubmit}>
              <FieldGroup label="New email">
                <Input {...emailForm.register("email")} type="email" />
                <FieldError message={emailForm.formState.errors.email?.message} />
              </FieldGroup>
              <Button disabled={emailForm.formState.isSubmitting} type="submit" variant="outline">
                Change email
              </Button>
            </form>

            <form className="space-y-4 border-t border-border pt-6" onSubmit={onPasswordSubmit}>
              <FieldGroup label="Current password">
                <Input {...passwordForm.register("currentPassword")} type="password" />
                <FieldError message={passwordForm.formState.errors.currentPassword?.message} />
              </FieldGroup>
              <FieldGroup label="New password">
                <Input {...passwordForm.register("newPassword")} type="password" />
                <FieldError message={passwordForm.formState.errors.newPassword?.message} />
              </FieldGroup>
              <FieldGroup label="Confirm new password">
                <Input {...passwordForm.register("confirmPassword")} type="password" />
                <FieldError message={passwordForm.formState.errors.confirmPassword?.message} />
              </FieldGroup>
              <Button disabled={passwordForm.formState.isSubmitting} type="submit" variant="outline">
                Change password
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account snapshot</CardTitle>
            <CardDescription>Current workspace status for this vendor account.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <InfoItem label="Business" value={user?.businessName ?? "-"} />
            <InfoItem label="Applications on file" value={`${applications.length}`} />
            <InfoItem
              label="Verified documents"
              value={`${documents.filter((item) => item.status === "Verified").length} / ${documents.length}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function VendorApplicationsPage() {
  const { applications, deleteApplication, saveApplication, submitApplication, documents, saveDocument, deleteDocument } = useVendorWorkspace();
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [applicationDraftValues, setApplicationDraftValues] = useState<ApplicationValues>(defaultApplicationValues);

  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const handleDocFileChange = async (docType: string, file: File | null) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setUploadingDoc(docType);
    try {
      let applicationId = selectedApplicationId;
      if (!applicationId) {
        applicationId = await saveApplication(applicationDraftValues);
        setSelectedApplicationId(applicationId);
      }
      const existing = applicationDocuments.find((d) => d.document === docType);
      await saveDocument(
        { document: docType, expiry: "", remarks: "", file, applicationId: applicationId ?? undefined },
        existing?.id ?? undefined,
      );
      toast.success(`${docType} uploaded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document. Please try again.");
    } finally {
      setUploadingDoc(null);
    }
  };

  const removeDocument = (documentId: string) => {
    deleteDocument(documentId);
    toast.success("Document removed.");
  };

  useEffect(() => {
    if (selectedApplicationId && !applications.some((item) => item.id === selectedApplicationId)) {
      setSelectedApplicationId(null);
    }
  }, [applications, selectedApplicationId]);

  const selectedApplication = applications.find((item) => item.id === selectedApplicationId) ?? null;
  const draftCount = applications.filter((item) => item.status === "Draft").length;
  const submittedCount = applications.filter((item) =>
    ["Submitted", "Under Review", "Approved", "Assigned"].includes(item.status),
  ).length;
  const revisionCount = applications.filter((item) => item.status === "Needs Resubmission").length;
  // Only show documents that belong to the currently selected application
  const applicationDocuments = selectedApplicationId
    ? documents.filter((d) => d.applicationId === selectedApplicationId)
    : [];
  const verifiedDocs = applicationDocuments.filter((d) => d.status === "Verified").length;

  const openNewApplicationModal = () => {
    setSelectedApplicationId(null);
    setApplicationDraftValues(defaultApplicationValues);
    setIsApplicationModalOpen(true);
  };

  const openApplicationModal = (applicationId: string) => {
    setSelectedApplicationId(applicationId);
    setIsApplicationModalOpen(true);
  };

  const handleSaveDraft = async (values: {
    businessType: string;
    preferredSection: string;
    preferredStallType: string;
    notes: string;
  }) => {
    const id = await saveApplication(values, selectedApplication?.id);
    setSelectedApplicationId(id);
    toast.success("Application draft saved.");
  };

  const handleSubmitApplication = async (values: {
    businessType: string;
    preferredSection: string;
    preferredStallType: string;
    notes: string;
  }) => {
    const id = await submitApplication(values, selectedApplication?.id);
    setSelectedApplicationId(id);
    setIsApplicationModalOpen(false);
    toast.success("Application submitted for review.");
  };

  const handleDeleteApplication = () => {
    if (!selectedApplication) return;
    deleteApplication(selectedApplication.id);
    setSelectedApplicationId(null);
    setIsApplicationModalOpen(false);
    toast.success("Application removed.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button onClick={openNewApplicationModal} variant="secondary">
            <FilePlus2 className="mr-2 h-4 w-4" />
            Start new application
          </Button>
        }
        description="Create, edit, submit, and manage your stall applications from a single workspace."
        eyebrow="Applications"
        title="Application workspace"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Applications on file" value={`${applications.length}`} />
        <SummaryCard label="Submitted or active" value={`${submittedCount}`} />
        <SummaryCard label="Drafts and revisions" value={`${revisionCount + draftCount}`} />
        <SummaryCard label="Verified documents" value={`${verifiedDocs} / ${documents.length}`} />
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Saved applications</CardTitle>
            <CardDescription>Review and open any request from a compact application register.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {applications.length === 0 ? (
              <div className="p-6">
                <EmptyState message="No application records yet. Start a new application to begin." />
              </div>
            ) : (
              <ApplicationsTable
                applications={applications}
                onDelete={(applicationId) => {
                  deleteApplication(applicationId);
                  if (selectedApplicationId === applicationId) setSelectedApplicationId(null);
                  toast.success("Application removed.");
                }}
                onSelect={openApplicationModal}
                selectedApplicationId={selectedApplicationId}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ApplicationModal
        isOpen={isApplicationModalOpen}
        onClose={() => setIsApplicationModalOpen(false)}
      >
        <div className="space-y-4">
          {/* ── Application form ── */}
          <StallApplicationForm
            description={
              selectedApplication
                ? "Update the selected application, save revisions, or submit it for administrator review."
                : "Prepare a new stall request. Documents can be uploaded and the draft will be saved automatically if needed."
            }
            initialValues={selectedApplication ?? undefined}
            onValuesChange={setApplicationDraftValues}
            onDelete={
              selectedApplication && canDeleteApplication(selectedApplication.status)
                ? handleDeleteApplication
                : undefined
            }
            onSaveDraft={handleSaveDraft}
            onSubmitApplication={handleSubmitApplication}
            saveLabel={selectedApplication ? "Save changes" : "Save draft"}
            submitLabel={selectedApplication ? "Resubmit application" : "Submit application"}
            title={selectedApplication ? "Edit application" : "New stall application"}
          />

          {/* ── Required documents ── */}
          <Card>
            <CardHeader>
              <CardTitle>Required documents</CardTitle>
              <CardDescription className="mt-1">
                Upload compliance files for this application. Each document can be replaced at any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REQUIRED_DOC_TYPES.map((docType) => {
                const uploaded = applicationDocuments.find((d) => d.document === docType);
                const isUploading = uploadingDoc === docType;
                return (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3" key={docType}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{docType}</p>
                      {uploaded ? (
                        <div className="mt-1 flex items-center gap-2">
                          <StatusBadge status={uploaded.status} />
                          {uploaded.fileUrl ? (
                            <a
                              className="text-xs text-primary underline-offset-4 hover:underline"
                              href={uploaded.fileUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              View file
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">No file uploaded yet</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <label className={`cursor-pointer rounded-full border-0 bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 ${isUploading ? "opacity-60 pointer-events-none" : ""}`}>
                        {isUploading ? "Uploading…" : uploaded ? "Replace" : "Choose File"}
                        <input
                          accept={ACCEPTED_DOC_TYPES}
                          className="sr-only"
                          disabled={isUploading}
                          onChange={(e) => handleDocFileChange(docType, e.target.files?.[0] ?? null)}
                          type="file"
                        />
                      </label>
                      {uploaded ? (
                        <Button onClick={() => removeDocument(uploaded.id)} size="sm" variant="destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ── Status timeline ── */}
          {selectedApplication ? (
            <Card>
              <CardHeader>
                <CardTitle>Status timeline</CardTitle>
                <CardDescription>Track the current status and milestone progression for this application.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ApplicationTimelineTable application={selectedApplication} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </ApplicationModal>
    </div>
  );
}

export function VendorBillingPage() {
  const { billings, paymentMethods, recordPayment } = useVendorWorkspace();
  const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);

  const orderedBillings = useMemo(
    () => [...billings].sort((left, right) => new Date(right.dueDate).getTime() - new Date(left.dueDate).getTime()),
    [billings],
  );

  useEffect(() => {
    if (selectedBillingId && billings.some((item) => item.id === selectedBillingId)) return;
    const next = orderedBillings.find((item) => item.amountPaid < item.amountDue) ?? orderedBillings[0] ?? null;
    setSelectedBillingId(next?.id ?? null);
  }, [billings, orderedBillings, selectedBillingId]);

  const selectedBilling = orderedBillings.find((item) => item.id === selectedBillingId) ?? null;
  const remainingBalance = selectedBilling ? Math.max(selectedBilling.amountDue - selectedBilling.amountPaid, 0) : 0;
  const totalOutstanding = billings.reduce((sum, item) => sum + Math.max(item.amountDue - item.amountPaid, 0), 0);
  const totalPaid = billings.reduce((sum, item) => sum + item.amountPaid, 0);

  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: remainingBalance ? String(remainingBalance) : "", method: paymentMethods[0] ?? "Cash", reference: "", advanceMonths: "1" },
  });

  useEffect(() => {
    form.reset({ amount: remainingBalance ? String(remainingBalance) : "", method: paymentMethods[0] ?? "Cash", reference: "", advanceMonths: "1" });
    setPaymentProof(null);
  }, [form, paymentMethods, remainingBalance, selectedBillingId]);

  const openPay = (id: string) => {
    setSelectedBillingId(id);
    setShowPayModal(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!selectedBilling) return;
    const amount = Number(values.amount);
    const advanceMonths = Number(values.advanceMonths);
    if (advanceMonths === 1 && amount > remainingBalance) {
      form.setError("amount", { type: "manual", message: `Payment cannot exceed ${formatCurrency(remainingBalance)}.` });
      return;
    }
    if (values.method === "GCash" && !values.reference?.trim()) {
      form.setError("reference", { type: "manual", message: "GCash reference number is required." });
      return;
    }
    if (values.method === "GCash" && !paymentProof) {
      toast.error("Upload proof of payment for GCash.");
      return;
    }
    await recordPayment({ billingId: selectedBilling.id, amount, method: values.method, reference: values.reference, proof: paymentProof, advanceMonths });
    setShowPayModal(false);
    toast.success("Payment submitted for finance verification.");
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="mr-2 h-4 w-4" />Print statement
          </Button>
        }
        description="Review balances, select a billing cycle, and log vendor-side payments."
        eyebrow="Billing"
        title="Billing and payments"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Outstanding balance" value={formatCurrency(totalOutstanding)} />
        <SummaryCard label="Total paid" value={formatCurrency(totalPaid)} />
        <SummaryCard label="Billing records" value={`${billings.length}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing records</CardTitle>
          <CardDescription>Select a billing month to pay or review the balance.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {orderedBillings.length === 0 ? (
            <div className="p-6"><EmptyState message="No billing records on file." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/80 text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold" scope="col">Billing month</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Due date</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Amount due</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Amount paid</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Remaining</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Status</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orderedBillings.map((item) => {
                    const remaining = Math.max(item.amountDue - item.amountPaid, 0);
                    return (
                      <tr className={`transition hover:bg-muted/30 ${item.id === selectedBillingId ? "bg-primary/5" : ""}`} key={item.id}>
                        <td className="px-6 py-4 font-medium text-foreground">{item.billingMonth}</td>
                        <td className="px-6 py-4 text-muted-foreground">{item.dueDate}</td>
                        <td className="px-6 py-4">{formatCurrency(item.amountDue)}</td>
                        <td className="px-6 py-4">{formatCurrency(item.amountPaid)}</td>
                        <td className="px-6 py-4 font-medium">{formatCurrency(remaining)}</td>
                        <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                        <td className="px-6 py-4">
                          {remaining > 0 ? (
                            <Button onClick={() => openPay(item.id)} size="sm" variant="outline">
                              <CreditCard className="mr-2 h-3 w-3" />Pay
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Paid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showPayModal && selectedBilling ? (
        <VendorModal onClose={() => setShowPayModal(false)} title={`Record payment — ${selectedBilling.billingMonth}`}>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoItem label="Billing month" value={selectedBilling.billingMonth} />
            <InfoItem label="Remaining balance" value={formatCurrency(remainingBalance)} />
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <FieldGroup label="Payment amount">
              <Input disabled={Number(form.watch("advanceMonths")) > 1} min="0" step="0.01" type="number" {...form.register("amount")} />
              <FieldError message={form.formState.errors.amount?.message} />
              {Number(form.watch("advanceMonths")) > 1 ? <p className="text-xs text-muted-foreground">Full outstanding balances for the selected months will be calculated automatically.</p> : null}
            </FieldGroup>
            <FieldGroup label="Months to cover">
              <Input max="12" min="1" type="number" {...form.register("advanceMonths")} />
              <p className="text-xs text-muted-foreground">Choose 2–12 to create and pay future monthly bills in advance.</p>
            </FieldGroup>
            <FieldGroup label="Payment method">
              <Select {...form.register("method")}>
                {paymentMethods.map((method) => <option key={method}>{method}</option>)}
              </Select>
              <FieldError message={form.formState.errors.method?.message} />
            </FieldGroup>
            <FieldGroup label="Reference number">
              <Input placeholder={form.watch("method") === "GCash" ? "Required GCash reference" : "Optional reference or OR number"} {...form.register("reference")} />
              <FieldError message={form.formState.errors.reference?.message} />
            </FieldGroup>
            <FieldGroup label={`Proof of payment${form.watch("method") === "GCash" ? " *" : ""}`}>
              <Input accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && file.size > 10 * 1024 * 1024) {
                  toast.error("Proof of payment must be 10 MB or smaller.");
                  event.target.value = "";
                  setPaymentProof(null);
                  return;
                }
                setPaymentProof(file);
              }} type="file" />
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG, or WebP; maximum 10 MB.</p>
            </FieldGroup>
            <div className="flex flex-wrap gap-3 border-t border-border pt-4">
              <Button disabled={form.formState.isSubmitting || remainingBalance <= 0} type="submit">
                <CreditCard className="mr-2 h-4 w-4" />Record payment
              </Button>
              <Button onClick={() => setShowPayModal(false)} type="button" variant="ghost">Cancel</Button>
            </div>
          </form>
        </VendorModal>
      ) : null}
    </div>
  );
}

export function VendorNotificationsPage() {
  const { notifications, deleteNotification, markAllNotificationsRead, toggleNotificationRead } = useVendorWorkspace();
  const [openedNotificationId, setOpenedNotificationId] = useState<string | null>(null);

  const orderedNotifications = useMemo(
    () => [...notifications].sort((left, right) => Number(left.read) - Number(right.read)),
    [notifications],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button onClick={() => { markAllNotificationsRead(); toast.success("All notifications marked as read."); }} variant="secondary">
            <BellRing className="mr-2 h-4 w-4" />Mark all as read
          </Button>
        }
        description="Read, clear, and manage alert messages tied to your applications, documents, billing, and stall."
        eyebrow="Notifications"
        title="Notification inbox"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard label="Total notifications" value={`${notifications.length}`} />
        <SummaryCard label="Unread" value={`${unreadCount}`} />
      </div>

      <Card>
        <CardContent className="p-0">
          {orderedNotifications.length === 0 ? (
            <div className="p-6"><EmptyState message="No notifications in your inbox." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/80 text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold" scope="col">Title</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Detail</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Status</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Read</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Timestamp</th>
                    <th className="px-6 py-4 font-semibold" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orderedNotifications.map((item) => (
                    <tr
                      className={`cursor-pointer transition hover:bg-muted/30 ${!item.read ? "bg-warning/5" : ""}`}
                      key={item.id}
                      onClick={() => {
                        setOpenedNotificationId(item.id);
                        if (!item.read) void toggleNotificationRead(item.id);
                      }}
                    >
                      <td className="px-6 py-4 font-medium text-foreground">{item.title}</td>
                      <td className="max-w-[260px] px-6 py-4 text-muted-foreground">
                        <p className="truncate">{item.detail}</p>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                      <td className="px-6 py-4">
                        {!item.read ? <Badge variant="warning">Unread</Badge> : <Badge variant="outline">Read</Badge>}
                      </td>
                      <td className="px-6 py-4 text-xs uppercase tracking-[0.14em] text-primary">{item.timestamp}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button onClick={(event) => { event.stopPropagation(); void deleteNotification(item.id); }} size="sm" variant="destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {openedNotificationId ? (() => {
        const opened = notifications.find((item) => item.id === openedNotificationId);
        return opened ? (
          <VendorModal onClose={() => setOpenedNotificationId(null)} title={opened.title}>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{opened.detail}</p>
            <div className="flex justify-end"><Button onClick={() => setOpenedNotificationId(null)}>Close</Button></div>
          </VendorModal>
        ) : null;
      })() : null}
    </div>
  );
}

function VendorModal({
  isOpen = true,
  onClose,
  title,
  children,
}: {
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", handler); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog">
      <button aria-label="Close" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} type="button" />
      <div className="relative z-10 w-full max-w-lg">
        <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
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
    </div>
  );
}

function ApplicationModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
    >
      <button
        aria-label="Close application form"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 w-full max-w-[596px]">
        <button
          aria-label="Close application form"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="max-h-[82vh] overflow-y-auto rounded-lg bg-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.5)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function ApplicationsTable({
  applications,
  selectedApplicationId,
  onSelect,
  onDelete,
}: {
  applications: VendorApplication[];
  selectedApplicationId: string | null;
  onSelect: (applicationId: string) => void;
  onDelete: (applicationId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-y border-border/70 bg-muted/35 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <tr>
            <th className="px-5 py-4 font-semibold">Business</th>
            <th className="px-5 py-4 font-semibold">Preference</th>
            <th className="px-5 py-4 font-semibold">Status</th>
            <th className="px-5 py-4 font-semibold">Updated</th>
            <th className="px-5 py-4 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {applications.map((item) => {
            const selected = item.id === selectedApplicationId;

            return (
              <tr
                className={`cursor-pointer align-top transition hover:bg-muted/30 ${
                  selected ? "bg-primary/5" : "bg-background/40"
                }`}
                key={item.id}
                onClick={() => onSelect(item.id)}
              >
                <td className="px-5 py-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{item.businessType}</p>
                    <p className="max-w-[18rem] text-sm leading-6 text-muted-foreground">{item.notes}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{item.preferredStallLabel}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {item.preferredSection} · {item.preferredStallType}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-5 py-4">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{item.updatedAt}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {item.submittedAt ? `Submitted ${item.submittedAt}` : "Draft record"}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(item.id);
                      }}
                      size="sm"
                      variant={selected ? "secondary" : "outline"}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      View details
                    </Button>
                    {canDeleteApplication(item.status) ? (
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(item.id);
                        }}
                        size="sm"
                        variant="destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ApplicationTimelineTable({ application }: { application: VendorApplication }) {
  const timeline = buildApplicationTimeline(application);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-y border-border/70 bg-muted/35 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <tr>
            <th className="px-5 py-4 font-semibold">Stage</th>
            <th className="px-5 py-4 font-semibold">State</th>
            <th className="px-5 py-4 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {timeline.map((item) => (
            <tr className={item.active ? "bg-emerald-50/60" : "bg-background/40"} key={item.label}>
              <td className="px-5 py-4 font-semibold text-foreground">{item.label}</td>
              <td className="px-5 py-4">
                {item.active ? <Badge variant="success">Reached</Badge> : <Badge variant="outline">Pending</Badge>}
              </td>
              <td className="px-5 py-4 leading-6 text-muted-foreground">{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillingCard({
  billing,
  selected,
  onSelect,
}: {
  billing: VendorBillingRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const remaining = Math.max(billing.amountDue - billing.amountPaid, 0);

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        selected ? "border-primary bg-primary/5" : "border-border/70 bg-background/70"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{billing.billingMonth}</p>
          <p className="mt-1 text-sm text-muted-foreground">Due {billing.dueDate}</p>
        </div>
        <StatusBadge status={billing.status} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoItem label="Amount due" value={formatCurrency(billing.amountDue)} />
        <InfoItem label="Amount paid" value={formatCurrency(billing.amountPaid)} />
        <InfoItem label="Remaining" value={formatCurrency(remaining)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={onSelect} size="sm" variant={selected ? "secondary" : "outline"}>
          <Send className="mr-2 h-4 w-4" />
          {remaining > 0 ? "Pay this bill" : "View record"}
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
}

function statusVariant(status: string) {
  if (["Active", "Approved", "Assigned", "Paid", "Verified", "Reached", "Resolved"].includes(status)) {
    return "success" as const;
  }

  if (
    ["Pending", "Submitted", "Partial", "Unpaid", "Under Review", "Pending Renewal Review", "Open", "In Review"].includes(
      status,
    )
  ) {
    return "warning" as const;
  }

  if (["Needs Resubmission", "Rejected", "Overdue"].includes(status)) {
    return "destructive" as const;
  }

  return "outline" as const;
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

function LoadingCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm leading-6 text-muted-foreground">{message}</p>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-medium leading-7 text-foreground">{value}</p>
    </div>
  );
}

function PlainInfo({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold text-slate-900 ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
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

function buildComplianceSummary(documents: VendorDocumentRecord[]) {
  return {
    verified: documents.filter((item) => item.status === "Verified").length,
    pending: documents.filter((item) => item.status === "Pending").length,
    resubmission: documents.filter((item) => item.status === "Needs Resubmission").length,
  };
}

function canDeleteApplication(status: VendorApplication["status"]) {
  return status === "Draft" || status === "Needs Resubmission";
}

function buildApplicationTimeline(application: VendorApplication) {
  const statusOrder: VendorApplication["status"][] = [
    "Draft",
    "Submitted",
    "Under Review",
    "Approved",
    "Assigned",
  ];
  const currentIndex = statusOrder.indexOf(application.status);
  const reachedIndex = currentIndex === -1 ? 2 : currentIndex;

  return [
    {
      label: "Draft",
      active: reachedIndex >= 0,
      description: `Application saved and last updated on ${application.updatedAt}.`,
    },
    {
      label: "Submitted",
      active: reachedIndex >= 1 || Boolean(application.submittedAt),
      description: application.submittedAt
        ? `Submitted on ${application.submittedAt}.`
        : "Awaiting final submission from the vendor.",
    },
    {
      label: "Under Review",
      active: reachedIndex >= 2 || application.status === "Needs Resubmission",
      description:
        application.status === "Needs Resubmission"
          ? "Administrator requested revisions before approval."
          : application.adminRemarks ?? "Pending validation by market operations staff.",
    },
    {
      label: "Approved",
      active: reachedIndex >= 3,
      description:
        application.status === "Approved" || application.status === "Assigned"
          ? application.adminRemarks ?? "Application passed review and is ready for assignment."
          : "Approval has not been issued yet.",
    },
    {
      label: "Assigned",
      active: reachedIndex >= 4,
      description:
        application.status === "Assigned"
          ? `Application completed and assigned to ${application.preferredStallLabel}.`
          : "Waiting for stall assignment.",
    },
  ];
}

function formatDateInputValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
