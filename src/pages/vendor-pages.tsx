import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Check,
  CreditCard,
  FilePlus2,
  PencilLine,
  Printer,
  RefreshCcw,
  Send,
  Trash2,
  Upload,
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
import { StallApplicationForm } from "@/features/applications/stall-application-form";
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

const documentSchema = z.object({
  document: z.string().min(2, "Document name is required."),
  expiry: z.string().min(1, "Expiry date is required."),
  remarks: z.string().min(4, "Add a short note for this upload."),
});

const ACCEPTED_DOC_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE_MB = 10;

const paymentSchema = z.object({
  amount: z
    .string()
    .min(1, "Enter a payment amount.")
    .refine((value) => Number(value) > 0, "Enter a payment amount."),
  method: z.string().min(2, "Payment method is required."),
  reference: z.string().optional(),
});

const supportRequestSchema = z.object({
  subject: z.string().min(3, "Issue subject is required."),
  detail: z.string().min(10, "Provide enough detail for the support request."),
});

type ProfileValues = z.infer<typeof profileSchema>;
type EmailChangeValues = z.infer<typeof emailChangeSchema>;
type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
type DocumentValues = z.infer<typeof documentSchema>;
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

  // Document sub-form state (lives inside the application modal)
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const editingDoc = documents.find((d) => d.id === editingDocId) ?? null;

  const docForm = useForm<DocumentValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: { document: "Barangay Clearance", expiry: "", remarks: "" },
  });

  useEffect(() => {
    docForm.reset({
      document: editingDoc?.document ?? "Barangay Clearance",
      expiry: editingDoc ? formatDateInputValue(editingDoc.expiry) : "",
      remarks: editingDoc?.remarks ?? "",
    });
    setDocFile(null);
    if (docFileInputRef.current) docFileInputRef.current.value = "";
  }, [editingDoc, docForm]);

  const openDocForm = (id?: string) => {
    setEditingDocId(id ?? null);
    setShowDocForm(true);
  };

  const closeDocForm = () => {
    setShowDocForm(false);
    setEditingDocId(null);
    setDocFile(null);
    if (docFileInputRef.current) docFileInputRef.current.value = "";
  };

  const onDocSubmit = docForm.handleSubmit(async (values) => {
    if (!editingDocId && !docFile) {
      docForm.setError("document", { type: "manual", message: "Please attach a file for the new document." });
      return;
    }
    if (docFile && docFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    if (!editingDocId && !selectedApplicationId) {
      toast.error("Save the application as a draft first before uploading documents.");
      return;
    }
    try {
      const result = await saveDocument(
        {
          document: values.document,
          expiry: formatDateLabel(values.expiry),
          remarks: values.remarks,
          file: docFile,
          applicationId: selectedApplicationId ?? undefined,
        },
        editingDocId ?? undefined,
      );
      closeDocForm();
      if (result.fileUploadWarning) {
        toast.warning("Document saved, but the file could not be uploaded. Please try attaching the file again.");
      } else {
        toast.success(editingDocId ? "Document updated." : "Document uploaded.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save document. Please try again.");
    }
  });

  const removeDocument = (documentId: string) => {
    deleteDocument(documentId);
    if (editingDocId === documentId) closeDocForm();
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
    setShowDocForm(false);
    setEditingDocId(null);
    setIsApplicationModalOpen(true);
  };

  const openApplicationModal = (applicationId: string) => {
    setSelectedApplicationId(applicationId);
    setShowDocForm(false);
    setEditingDocId(null);
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
                : "Prepare a new stall request. Drafts stay editable until you submit them."
            }
            initialValues={selectedApplication ?? undefined}
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Required documents</CardTitle>
                  <CardDescription className="mt-1">
                    {!selectedApplicationId
                      ? "Save the application as a draft first to enable document uploads."
                      : applicationDocuments.length > 0
                        ? `Upload compliance files needed to process this application. ${verifiedDocs} of ${applicationDocuments.length} verified.`
                        : "Upload compliance files needed to process this application. No documents uploaded yet."}
                  </CardDescription>
                </div>
                <Button
                  disabled={!selectedApplicationId}
                  onClick={() => openDocForm()}
                  size="sm"
                  title={!selectedApplicationId ? "Save a draft first to unlock document uploads" : undefined}
                  variant="secondary"
                >
                  <Upload className="mr-2 h-3 w-3" />Add document
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Inline upload / edit form */}
              {showDocForm ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {editingDocId ? "Edit document" : "Upload document"}
                    </p>
                    <button
                      aria-label="Close form"
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                      onClick={closeDocForm}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <form className="space-y-3" onSubmit={onDocSubmit}>
                    <FieldGroup label="Document type">
                      <Select {...docForm.register("document")}>
                        <option>Barangay Clearance</option>
                        <option>Police Clearance</option>
                        <option>Health Clearance</option>
                        <option>DTI Registration</option>
                        <option>Business Permit</option>
                      </Select>
                      <FieldError message={docForm.formState.errors.document?.message} />
                    </FieldGroup>

                    {/* File attachment */}
                    <FieldGroup label={editingDocId ? "Replace file (optional)" : "Attach file *"}>
                      <input
                        accept={ACCEPTED_DOC_TYPES}
                        className="block w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                        onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                        ref={docFileInputRef}
                        type="file"
                      />
                      {docFile ? (
                        <p className="text-xs text-muted-foreground">
                          Selected: <span className="font-medium text-foreground">{docFile.name}</span> ({(docFile.size / 1024).toFixed(0)} KB)
                        </p>
                      ) : editingDoc?.fileUrl ? (
                        <p className="text-xs text-muted-foreground">
                          Current file attached — upload a new one to replace it.
                        </p>
                      ) : null}
                    </FieldGroup>

                    <div className="grid gap-3 md:grid-cols-2">
                      <FieldGroup label="Expiry date">
                        <Input type="date" {...docForm.register("expiry")} />
                        <FieldError message={docForm.formState.errors.expiry?.message} />
                      </FieldGroup>
                      <FieldGroup label="Remarks">
                        <Input placeholder="Brief note about this upload" {...docForm.register("remarks")} />
                        <FieldError message={docForm.formState.errors.remarks?.message} />
                      </FieldGroup>
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={docForm.formState.isSubmitting} size="sm" type="submit">
                        {editingDocId ? "Save changes" : "Upload document"}
                      </Button>
                      {editingDocId ? (
                        <Button
                          onClick={() => removeDocument(editingDocId)}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          <Trash2 className="mr-2 h-3 w-3" />Delete
                        </Button>
                      ) : null}
                      <Button onClick={closeDocForm} size="sm" type="button" variant="ghost">Cancel</Button>
                    </div>
                  </form>
                </div>
              ) : null}

              {/* Document table */}
              {applicationDocuments.length === 0 && !showDocForm ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                  {selectedApplicationId ? (
                    <Button className="mt-3" onClick={() => openDocForm()} size="sm" variant="outline">
                      Upload your first document
                    </Button>
                  ) : null}
                </div>
              ) : applicationDocuments.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="min-w-full divide-y divide-border/80 text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold" scope="col">Document</th>
                        <th className="px-4 py-3 font-semibold" scope="col">File</th>
                        <th className="px-4 py-3 font-semibold" scope="col">Expiry</th>
                        <th className="px-4 py-3 font-semibold" scope="col">Status</th>
                        <th className="px-4 py-3 font-semibold" scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {applicationDocuments.map((doc) => (
                        <tr
                          className={`transition hover:bg-muted/30 ${editingDocId === doc.id ? "bg-primary/5" : ""}`}
                          key={doc.id}
                        >
                          <td className="px-4 py-3 font-medium text-foreground">{doc.document}</td>
                          <td className="px-4 py-3">
                            {doc.fileUrl ? (
                              <a
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                                href={doc.fileUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                View file
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">No file</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{doc.expiry}</td>
                          <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button onClick={() => openDocForm(doc.id)} size="sm" variant="outline">
                                <PencilLine className="mr-1 h-3 w-3" />Edit
                              </Button>
                              <Button onClick={() => removeDocument(doc.id)} size="sm" variant="destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
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
  const { billings, recordPayment } = useVendorWorkspace();
  const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);

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
    defaultValues: { amount: remainingBalance ? String(remainingBalance) : "", method: "Cash", reference: "" },
  });

  useEffect(() => {
    form.reset({ amount: remainingBalance ? String(remainingBalance) : "", method: "Cash", reference: "" });
  }, [form, remainingBalance, selectedBillingId]);

  const openPay = (id: string) => {
    setSelectedBillingId(id);
    setShowPayModal(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!selectedBilling) return;
    const amount = Number(values.amount);
    if (amount > remainingBalance) {
      form.setError("amount", { type: "manual", message: `Payment cannot exceed ${formatCurrency(remainingBalance)}.` });
      return;
    }
    await recordPayment({ billingId: selectedBilling.id, amount, method: values.method, reference: values.reference });
    setShowPayModal(false);
    toast.success("Payment recorded in the billing ledger.");
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
              <Input min="0" step="0.01" type="number" {...form.register("amount")} />
              <FieldError message={form.formState.errors.amount?.message} />
            </FieldGroup>
            <FieldGroup label="Payment method">
              <Select {...form.register("method")}>
                <option>Cash</option><option>GCash</option><option>Bank Transfer</option>
              </Select>
              <FieldError message={form.formState.errors.method?.message} />
            </FieldGroup>
            <FieldGroup label="Reference number">
              <Input placeholder="Optional reference or OR number" {...form.register("reference")} />
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
                    <tr className={`transition hover:bg-muted/30 ${!item.read ? "bg-warning/5" : ""}`} key={item.id}>
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
                          <Button onClick={() => toggleNotificationRead(item.id)} size="sm" variant="outline">
                            <Check className="mr-2 h-3 w-3" />{item.read ? "Unread" : "Read"}
                          </Button>
                          <Button onClick={() => deleteNotification(item.id)} size="sm" variant="destructive">
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
          ? `Assigned to ${application.preferredStallLabel}.`
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
