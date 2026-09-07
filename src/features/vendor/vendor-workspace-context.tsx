import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth/auth-context";
import {
  deleteVendorApplication as deleteVendorApplicationRemote,
  deleteVendorDocument as deleteVendorDocumentRemote,
  deleteVendorNotification as deleteVendorNotificationRemote,
  fetchVendorWorkspace,
  markAllVendorNotificationsRead,
  recordVendorPayment,
  requestVendorLeaseRenewal,
  saveVendorApplication,
  saveVendorDocument,
  submitVendorApplication,
  submitVendorSupportRequest,
  toggleVendorNotificationRead,
  type VendorStallInfo,
} from "@/integrations/supabase/vendor-service";

export type VendorApplicationStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Assigned"
  | "Needs Resubmission"
  | "Rejected";

export type VendorDocumentStatus = "Pending" | "Verified" | "Needs Resubmission" | "Rejected";
export type VendorBillingStatus = "Paid" | "Partial" | "Unpaid" | "Overdue";
export type VendorSupportRequestStatus = "Open" | "In Review" | "Resolved";

export interface VendorApplication {
  id: string;
  businessType: string;
  preferredSection: string;
  preferredStallType: string;
  notes: string;
  status: VendorApplicationStatus;
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
  status: VendorDocumentStatus;
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
  status: VendorBillingStatus;
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

export interface VendorSupportRequest {
  id: string;
  subject: string;
  detail: string;
  requestedAt: string;
  status: VendorSupportRequestStatus;
}

export type VendorStallRecord = VendorStallInfo;

interface VendorWorkspaceState {
  applications: VendorApplication[];
  documents: VendorDocumentRecord[];
  billings: VendorBillingRecord[];
  notifications: VendorNotificationRecord[];
  stall: VendorStallInfo;
  paymentMethods: string[];
}

interface VendorProfileInput {
  name: string;
  email?: string;
  phone: string;
  businessName: string;
}

interface VendorApplicationInput {
  businessType: string;
  preferredSection: string;
  preferredStallType: string;
  notes: string;
}

interface VendorDocumentInput {
  document: string;
  expiry: string;
  remarks: string;
  file?: File | null;
  applicationId?: string;
}

interface VendorPaymentInput {
  billingId: string;
  amount: number;
  method: string;
  reference?: string;
  proof?: File | null;
  advanceMonths?: number;
}

interface VendorSupportRequestInput {
  subject: string;
  detail: string;
}

interface VendorWorkspaceContextValue extends VendorWorkspaceState {
  isReady: boolean;
  saveProfile: (input: VendorProfileInput) => Promise<void>;
  saveApplication: (input: VendorApplicationInput, applicationId?: string) => Promise<string>;
  submitApplication: (input: VendorApplicationInput, applicationId?: string) => Promise<string>;
  deleteApplication: (applicationId: string) => Promise<void>;
  saveDocument: (input: VendorDocumentInput, documentId?: string) => Promise<{ id: string; fileUploadWarning: string | null }>;
  deleteDocument: (documentId: string) => Promise<void>;
  recordPayment: (input: VendorPaymentInput) => Promise<void>;
  requestLeaseRenewal: () => Promise<void>;
  submitSupportRequest: (input: VendorSupportRequestInput) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  toggleNotificationRead: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const VendorWorkspaceContext = createContext<VendorWorkspaceContextValue | undefined>(undefined);

function emptyState(): VendorWorkspaceState {
  return {
    applications: [],
    documents: [],
    billings: [],
    notifications: [],
    stall: {
      stall: "No stall assigned",
      section: "-",
      type: "-",
      rate: "-",
      leaseStart: "-",
      leaseEnd: "-",
      notes: "No active lease notes available.",
      renewalStatus: "Not Requested",
      supportRequests: [],
    },
    paymentMethods: ["Cash", "GCash"],
  };
}

export function VendorWorkspaceProvider({ children }: { children: ReactNode }) {
  const { updateProfile, user } = useAuth();
  const [state, setState] = useState<VendorWorkspaceState>(emptyState);
  const [isReady, setIsReady] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!user || user.role !== "vendor") {
      setState(emptyState());
      setIsReady(true);
      return;
    }

    const snapshot = await fetchVendorWorkspace(user.id);
    setState(snapshot);
    setIsReady(true);
  }, [user]);

  useEffect(() => {
    setIsReady(false);
    void loadWorkspace();
  }, [loadWorkspace]);

  const refreshRemote = useCallback(async () => {
    if (!user) {
      return;
    }

    const snapshot = await fetchVendorWorkspace(user.id);
    setState(snapshot);
  }, [user]);

  const value = useMemo<VendorWorkspaceContextValue>(
    () => ({
      ...state,
      isReady,
      async saveProfile(input) {
        await updateProfile(input);
      },
      async saveApplication(input, applicationId) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        const id = await saveVendorApplication(user.id, input, applicationId);
        await refreshRemote();
        return id;
      },
      async submitApplication(input, applicationId) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        const id = await submitVendorApplication(user.id, input, applicationId);
        await refreshRemote();
        return id;
      },
      async deleteApplication(applicationId) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        await deleteVendorApplicationRemote(user.id, applicationId);
        await refreshRemote();
      },
      async saveDocument(input, documentId) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        const result = await saveVendorDocument(user.id, input, documentId);
        await refreshRemote();
        return result;
      },
      async deleteDocument(documentId) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        await deleteVendorDocumentRemote(documentId);
        await refreshRemote();
      },
      async recordPayment(input) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        await recordVendorPayment(user.id, input);
        await refreshRemote();
      },
      async requestLeaseRenewal() {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        await requestVendorLeaseRenewal(user.id);
        await refreshRemote();
      },
      async submitSupportRequest(input) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        await submitVendorSupportRequest(user.id, input);
        await refreshRemote();
      },
      async markAllNotificationsRead() {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        await markAllVendorNotificationsRead(user.id);
        await refreshRemote();
      },
      async toggleNotificationRead(notificationId) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        const currentNotification = state.notifications.find((item) => item.id === notificationId);
        await toggleVendorNotificationRead(user.id, notificationId, !currentNotification?.read);
        await refreshRemote();
      },
      async deleteNotification(notificationId) {
        if (!user) {
          throw new Error("No active vendor session.");
        }

        await deleteVendorNotificationRemote(user.id, notificationId);
        await refreshRemote();
      },
    }),
    [isReady, refreshRemote, state, updateProfile, user],
  );

  return <VendorWorkspaceContext.Provider value={value}>{children}</VendorWorkspaceContext.Provider>;
}

export function useVendorWorkspace() {
  const context = useContext(VendorWorkspaceContext);

  if (!context) {
    throw new Error("useVendorWorkspace must be used within a VendorWorkspaceProvider");
  }

  return context;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}
