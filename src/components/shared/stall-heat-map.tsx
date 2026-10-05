import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/auth-context";
import { fetchVendorOptions, saveStall } from "@/integrations/supabase/admin-service";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import type { AdminStallRecord } from "@/integrations/supabase/admin-service";
import { MAP_SHEETS } from "./stall-map-layouts";
import type { BlockPlacement, StallPlacement } from "./stall-map-layouts";

interface StallHeatMapProps {
  stalls: AdminStallRecord[];
  onEdit?: (id: string) => void;
}

interface PanelState { stall: AdminStallRecord | null; stallNum: string }

type StatusKey = "available" | "occupied" | "reserved" | "under_maintenance" | "inactive" | "unknown";

function normalizeStatus(status: string): StatusKey {
  const s = status.toLowerCase().replace(/\s+/g, "_");
  if (s === "available") return "available";
  if (s === "occupied") return "occupied";
  if (s === "reserved") return "reserved";
  if (s === "under_maintenance") return "under_maintenance";
  if (s === "inactive") return "inactive";
  return "unknown";
}

const STATUS_STYLES: Record<StatusKey, { bg: string; border: string; text: string; dot: string; label: string }> = {
  available:         { bg: "linear-gradient(135deg,#dcfce7,#bbf7d0)", border: "#16a34a", text: "#14532d", dot: "#16a34a", label: "Available" },
  occupied:          { bg: "linear-gradient(135deg,#fee2e2,#fecaca)", border: "#dc2626", text: "#7f1d1d", dot: "#dc2626", label: "Occupied" },
  reserved:          { bg: "linear-gradient(135deg,#fef9c3,#fef08a)", border: "#ca8a04", text: "#713f12", dot: "#ca8a04", label: "Reserved" },
  under_maintenance: { bg: "linear-gradient(135deg,#ffedd5,#fed7aa)", border: "#ea580c", text: "#431407", dot: "#ea580c", label: "Under Maintenance" },
  inactive:          { bg: "linear-gradient(135deg,#f3f4f6,#e5e7eb)", border: "#9ca3af", text: "#374151", dot: "#9ca3af", label: "Inactive" },
  unknown:           { bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)", border: "#93c5fd", text: "#1e40af", dot: "#93c5fd", label: "No Record" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function BlueprintTile({ placement, stall, onEdit, onSelect }: {
  placement: StallPlacement;
  stall?: AdminStallRecord;
  onEdit?: (id: string) => void;
  onSelect: (stall: AdminStallRecord | null, stallNum: string) => void;
}) {
  const sk = stall ? normalizeStatus(stall.status) : "unknown";
  const ss = STATUS_STYLES[sk];
  const sectionLabel = stall?.type?.trim();
  return (
    <button
      aria-label={stall ? `Stall ${stall.stall} — ${stall.status}` : `Stall ${placement.num}`}
      className="absolute flex items-center justify-center select-none group transition-transform duration-100 hover:scale-[1.08] hover:z-10"
      onClick={() => onSelect(stall ?? null, placement.num)}
      style={{
        left: placement.x, top: placement.y,
        width: placement.w, height: placement.h,
        background: ss.bg, border: `1.5px solid ${ss.border}`,
        borderRadius: 4, cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,0.09)", zIndex: 1,
      }}
      title={stall ? `${stall.stall} — ${stall.status}` : `Stall ${placement.num}`}
      type="button"
    >
      <span className="flex min-w-0 flex-col items-center leading-none" style={{ color: ss.text }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{placement.num}</span>
        {sectionLabel ? <span className="mt-1 max-w-full truncate px-0.5 text-[6px] font-bold uppercase">{sectionLabel}</span> : null}
      </span>
      <span className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.10)" }} />
    </button>
  );
}

function BlockTile({ p }: { p: BlockPlacement }) {
  return (
    <div className="absolute flex items-center justify-center border border-gray-300 bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wide text-gray-500"
      style={{ left: p.x, top: p.y, width: p.w, height: p.h }}>
      {p.label}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 pt-2.5 pb-3 border-t border-gray-100 bg-white">
      {(Object.entries(STATUS_STYLES) as [StatusKey, typeof STATUS_STYLES[StatusKey]][])
        .filter(([key]) => key === "available" || key === "occupied" || key === "under_maintenance")
        .map(([, s]) => (
        <div className="flex items-center gap-1.5" key={s.label}>
          <span className="inline-block h-3 w-3 rounded-sm border" style={{ background: s.bg, borderColor: s.border }} />
          <span className="text-[11px] font-medium" style={{ color: s.text }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stall Modal ───────────────────────────────────────────────────────────────
// ── Shared field wrapper ──────────────────────────────────────────────────────
function MF({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-[#f8faff] px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#1e3a8a] focus:bg-white transition";
const selectCls = inputCls + " cursor-pointer";

// ── Stall modal — shows occupant info if occupied, assign-vendor form if available ─
function StallModal({ stall, stallNum, onClose }: {
  stall: AdminStallRecord | null;
  stallNum: string;
  onEdit?: (id: string) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const displayName = stall ? stall.stall : `Stall ${stallNum}`;
  const statusOccupied = stall ? normalizeStatus(stall.status) === "occupied" : false;
  // Occupied stalls with no vendor linked fall through to the assign form
  const isOccupied = statusOccupied && !!stall?.currentVendorId;
  const isUnlinked = statusOccupied && !isOccupied;

  const [selectedVendorId, setSelectedVendorId] = useState("");

  const { data: vendorOptions = [], isPending: loadingVendors } = useQuery({
    queryKey: ["admin-vendor-options"],
    queryFn: fetchVendorOptions,
    enabled: isSupabaseConfigured && !isOccupied,
  });

  const assign = useMutation({
    mutationFn: () => {
      if (!stall) return Promise.reject(new Error("Stall record not found in database."));
      if (!selectedVendorId) return Promise.reject(new Error("Please select a vendor."));
      return saveStall(user!.id, {
        stallId: stall.id,
        sectionId: stall.sectionId,
        stallNumber: stall.stallNumber,
        stallType: stall.type,
        monthlyRate: stall.rate,
        status: "occupied",
        notes: stall.notes,
        vendorId: selectedVendorId,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-stalls"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard-live"] }),
      ]);
      toast.success(`Vendor assigned to ${displayName}`);
      onClose();
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460, maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* ── Header ── */}
        <div className="px-7 pt-6 pb-4 border-b-2" style={{ borderColor: isOccupied ? "#dc2626" : "#1e3a8a" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-wide" style={{ color: isOccupied ? "#dc2626" : "#1e3a8a" }}>
              {isOccupied ? "CURRENT OCCUPANT" : "ASSIGN VENDOR"}
            </h2>
            <button className="text-gray-400 hover:text-gray-600 transition text-xl font-light leading-none" onClick={onClose} type="button">×</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-7 py-5 overflow-y-auto flex flex-col gap-4">
          <MF label="Stall Number">
            <input className={inputCls + " bg-gray-50 text-gray-500 cursor-not-allowed"} readOnly value={displayName} />
          </MF>

          {isOccupied ? (
            /* ── Occupied: show read-only current occupant info ── */
            <>
              <div style={{ background: "#fff7f7", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>This stall is currently occupied</p>
                <div className="flex flex-col gap-3">
                  <InfoRow label="Vendor / Leaseholder" value={stall?.currentVendorName ?? "—"} />
                  <InfoRow label="Email" value={stall?.currentVendorEmail ?? "—"} />
                  <InfoRow label="Phone" value={stall?.currentVendorPhone ?? "—"} />
                  <InfoRow label="Stall Type" value={stall?.type ?? "—"} />
                  <InfoRow label="Monthly Rate" value={stall?.rate ? `₱${stall.rate.toLocaleString()}` : "—"} />
                  <InfoRow label="Status" value={stall?.status ?? "—"} highlight />
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>
                To reassign this stall, first change its status to <strong>Available</strong> via the Edit Stall action.
              </p>
            </>
          ) : (
            /* ── Available: pick existing vendor from dropdown ── */
            <>
            {isUnlinked && (
              <p style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e" }}>
                This stall is marked <strong>Occupied</strong> but has no vendor linked to it. Select a vendor below to link one.
              </p>
            )}
            <MF label="Select Vendor" required>
              <select
                className={selectCls}
                disabled={loadingVendors}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                value={selectedVendorId}
              >
                <option value="">{loadingVendors ? "Loading vendors…" : "— Choose a vendor —"}</option>
                {vendorOptions.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </MF>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-7 py-4 border-t border-gray-100 flex gap-3">
          {!isOccupied && (
            <button
              className="flex-1 py-3 rounded-lg text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedVendorId || assign.isPending}
              onClick={() => assign.mutate()}
              style={{ background: "#1e3a8a" }}
              type="button"
            >
              {assign.isPending ? "ASSIGNING…" : "ASSIGN VENDOR"}
            </button>
          )}
          <button
            className="flex-1 py-3 rounded-lg text-sm font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 transition"
            onClick={onClose}
            type="button"
          >
            {isOccupied ? "CLOSE" : "CANCEL"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: highlight ? 700 : 600, color: highlight ? "#dc2626" : "#111827", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function StallHeatMap({ stalls, onEdit }: StallHeatMapProps) {
  const [modal, setModal] = useState<PanelState | null>(null);
  const [sheetId, setSheetId] = useState(MAP_SHEETS[0].id);
  const sheet = MAP_SHEETS.find((s) => s.id === sheetId) ?? MAP_SHEETS[0];

  const stallMap = useMemo(() => {
    const map = new Map<string, AdminStallRecord>();
    for (const s of stalls) {
      const status = normalizeStatus(s.status);
      if (status === "available" || status === "occupied" || status === "under_maintenance") {
        map.set(s.stallNumber, s);
      }
    }
    return map;
  }, [stalls]);

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { available: 0, occupied: 0, reserved: 0, under_maintenance: 0, inactive: 0, unknown: 0 };
    for (const p of sheet.stalls) {
      const s = stallMap.get(p.num);
      c[s ? normalizeStatus(s.status) : "unknown"]++;
    }
    return c;
  }, [stallMap, sheet]);

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Sheet tabs */}
      <div className="flex flex-wrap gap-1 px-4 pt-3 border-b border-gray-200">
        {MAP_SHEETS.map((s) => (
          <button
            aria-pressed={s.id === sheet.id}
            className="rounded-t-md px-3.5 py-2 text-[13px] font-semibold transition"
            key={s.id}
            onClick={() => setSheetId(s.id)}
            style={s.id === sheet.id ? { background: "#1e3a8a", color: "#fff" } : { color: "#374151" }}
            type="button"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 py-2 border-b border-gray-100 bg-gray-50">
        {(Object.entries(STATUS_STYLES) as [StatusKey, typeof STATUS_STYLES[StatusKey]][])
          .filter(([key]) => key === "available" || key === "occupied" || key === "under_maintenance")
          .map(([key, s]) => counts[key] > 0 ? (
            <div className="flex items-center gap-1.5 text-xs" key={key}>
              <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
              <span className="text-gray-600 font-medium">{s.label}</span>
              <span className="font-bold" style={{ color: s.text }}>{counts[key]}</span>
            </div>
          ) : null)}
        {counts.unknown > 0 ? (
          <span className="text-xs text-gray-500">
            {counts.unknown} of {sheet.stalls.length} stalls on this sheet have no record ({stalls.length} stall records loaded)
          </span>
        ) : null}
      </div>

      {/* Scrollable map */}
      <div className="overflow-auto">
        <div className="relative bg-white" style={{ width: sheet.width, height: sheet.height }}>
          {sheet.blocks?.map((b, i) => <BlockTile key={i} p={b} />)}

          {/* All stalls */}
          {sheet.stalls.map((p, i) => {
            const stall = stallMap.get(p.num);
            return stall ? (
              <BlueprintTile
                key={`${p.num}-${i}`}
                onEdit={onEdit}
                onSelect={(s, num) => setModal({ stall: s, stallNum: num })}
                placement={p}
                stall={stall}
              />
            ) : null;
          })}
        </div>
      </div>

      <Legend />

      {modal ? (
        <StallModal
          onClose={() => setModal(null)}
          onEdit={onEdit}
          stall={modal.stall}
          stallNum={modal.stallNum}
        />
      ) : null}
    </div>
  );
}
