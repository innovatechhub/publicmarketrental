import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/auth-context";
import { saveStall } from "@/integrations/supabase/admin-service";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import type { AdminStallRecord } from "@/integrations/supabase/admin-service";

interface StallHeatMapProps {
  stalls: AdminStallRecord[];
  onEdit?: (id: string) => void;
}

interface PanelState { stall: AdminStallRecord | null; stallNum: string }
interface StallPlacement { num: string; x: number; y: number; w: number; h: number }
interface EmptyPlacement { x: number; y: number; w: number; h: number }

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

function col(nums: string[], x: number, y0: number, w: number, h: number, gap = 1): StallPlacement[] {
  return nums.map((num, i) => ({ num, x, y: y0 + i * (h + gap), w, h }));
}
function row(nums: string[], x0: number, y: number, w: number, h: number, gap = 2): StallPlacement[] {
  return nums.map((num, i) => ({ num, x: x0 + i * (w + gap), y, w, h }));
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT — all coordinates are INSIDE the wall boundary
//
// Wall boundary (outer edge):
//   Top-left  : (WALL_L, WALL_T)
//   Top-right : (WALL_R, WALL_T)
//   The wall forms a U-shape open at nothing — it's a closed floor plan.
//
// Stall cell sizes:
//   Side columns (left/right): W=76, H=38, vertical step=40
//   Centre double columns:      W=54, H=38, vertical step=40
//   Bottom row:                 W=46, H=38
//
// Inner margin from wall to first cell: 6px on each side.
// ─────────────────────────────────────────────────────────────────────────────

const WALL_L = 30;
const WALL_T = 36;
const WALL_R = 544;
const WALL_B = 656;
const CANVAS_W = 1580;
const CANVAS_H = 840;
const PAD = 9;

// Cell sizes
const SCW = 50, SCH = 24;
const DCW = 38, DCH = 20;
const BRW = 28, BRH = 24;
const SIDE_STEP = SCH + 1;
const CENTER_STEP = DCH + 2;
const BOTTOM_STEP = BRW + 2;
const VSTEP = SCH + 2;      // 40 — vertical step for all columns

// ── LEFT column ──────────────────────────────────────────────────────────────
const LX = WALL_L + PAD;
const LT_Y = WALL_T + 12;          // 26 — top of first stall (12)

// Top block: 12 → 7  (6 cells), y: 26 → 26 + 6×40 = 266
const LEFT_TOP = col(["12","11","10","9","8","7"], LX, LT_Y, SCW, SCH);

// Lift zone height: stair-box (54px) + gap
const LIFT_H = 48;
const LIFT_L_Y = LT_Y + 6 * SIDE_STEP + 18;   // 266

// Bottom block: 6 → 1  (6 cells), y: 266+54=320 → 320+240=560
const LB_Y = LIFT_L_Y + LIFT_H + 6;      // 320
const LEFT_BOTTOM = col(["6","5","4","3","2","1"], LX, LB_Y, SCW, SCH);

// Blank tile + row 36–40 — same y as bottom of left column
const HR_Y = LB_Y + 6 * SIDE_STEP + 2;      // 560
const HR_X0 = LX + SCW + 3;          // 106
const LB_BLANK: EmptyPlacement = { x: LX, y: HR_Y, w: SCW, h: SCH };
const LEFT_ROW = row(["36","37","38","39","40"], HR_X0, HR_Y, BRW, BRH);
// row ends at x = 106 + 5*48 = 346

// ── RIGHT column ─────────────────────────────────────────────────────────────
// The right column sits flush to the right wall.
// Canvas width is driven by: right stall right edge + PAD + wall thickness
// Right column top aligns with left column top (y=26).
//
// We'll determine RX after fixing the canvas width below.
// For now compute with target canvas width.

// Right column top block: 60 → 50  (11 cells)
const RT_Y = WALL_T + 19;

// Right lift zone
const LIFT_R_Y = RT_Y + 11 * SIDE_STEP + 12;

// Right bottom block: 49 → 40  (10 cells)
const RB_Y = LIFT_R_Y + LIFT_H + 12;

// ── CENTRE double columns ────────────────────────────────────────────────────
// Horizontally centred in the floor plan.
// Centre-top starts at y ≈ 160, matching the reference image.
const CT_Y = 166;
const CB_Y = CT_Y + 8 * CENTER_STEP + 22;  // 160 + 320 + 20 = 500 — bottom pair start

// Bottom row (240–243 | stair | 245–248)
const BOT_Y = 516; // 500 + 200 + 20 = 720

// ── Canvas size ───────────────────────────────────────────────────────────────
// Height: bottom of right column (RB_Y + 10*40 = 520+400=920) vs bottom row (BOT_Y+38=758)
// Right column is the tallest → canvas height = RB_Y + 10*VSTEP + PAD + wall

// Width: need to fit right column + lift box + right wall
// Right lift box sits to the right of the right column: lift_w = 62px
// RX + SCW + 4 + 62 + PAD + wall ≤ CANVAS_W
// Decide CANVAS_W = 1060

// RX: right stall column x — right-align against WALL_R - PAD - SCW
const RX = WALL_R - PAD - SCW + 14;
const RIGHT_AUX_X = RX + SCW - 34;
const RIGHT_AUX_W = WALL_R - RIGHT_AUX_X - 4;

// ── Centre columns x ─────────────────────────────────────────────────────────
// Horizontally: centre them between the left col right-edge and right col left-edge
// Left col right edge: LX + SCW = 102
// Right col left edge: RX = 958
// Mid point: (102 + 958) / 2 = 530
// Centre pair total width: DCW + 2 + DCW = 110
const CCL_X = 340;
const CCR_X = CCL_X + DCW + 2;

// Recompute bottom row to align with centre columns
// 240–243: 4 cells, ending at CCL_X (aligned to centre-left column left edge)
const BOT_L_X0 = 216;
const BOTTOM_LEFT  = row(["240","241","242","243"], BOT_L_X0, BOT_Y, BRW, BRH);
// 245–248: starting at CCR_X + DCW + stair_gap(38)
const BOT_STAIR_X = BOT_L_X0 + 4 * BOTTOM_STEP + 4;
const BOT_STAIR_W = 26;
const BOT_R_X0 = BOT_STAIR_X + BOT_STAIR_W + 4;
const BOTTOM_RIGHT = row(["245","246","247","248"], BOT_R_X0, BOT_Y, BRW, BRH);

const MAIN_X = 740;
const MAIN_Y = 48;
const MCW = 46, MCH = 30;
const MSTEP_X = MCW + 1;
const MSTEP_Y = MCH + 34;
const MAIN_GAP_1 = 32;
const MAIN_GAP_2 = 42;

function mainRow(
  y: number,
  left: string[],
  middle: string[],
  right: string[],
): StallPlacement[] {
  const leftRow = row(left, MAIN_X, y, MCW, MCH, 1);
  const middleX = MAIN_X + left.length * (MCW + 1) + MAIN_GAP_1;
  const middleRow = row(middle, middleX, y, MCW, MCH, 1);
  const rightX = middleX + middle.length * (MCW + 1) + MAIN_GAP_2;
  return [...leftRow, ...middleRow, ...row(right, rightX, y, MCW, MCH, 1)];
}

const MAIN_TOP = [
  ...mainRow(MAIN_Y + 0 * MSTEP_Y, ["576","575","574","573","572","571"], ["570","569","568","567"], ["566","565","564","563","562"]),
  ...mainRow(MAIN_Y + 1 * MSTEP_Y, ["577","578","579","580","581","582"], ["583","584","585","586"], ["587","588","589","590","591"]),
  ...mainRow(MAIN_Y + 2 * MSTEP_Y, ["606","605","604","603","602","601"], ["600","599","598","597"], ["596","595","594","593","592"]),
  ...mainRow(MAIN_Y + 3 * MSTEP_Y, ["607","608","609","610","611","612"], ["613","614","615","616"], ["617","618","619","620","621"]),
  ...mainRow(MAIN_Y + 4 * MSTEP_Y, ["636","635","634","633","632","631"], ["630","629","628","627"], ["626","625","624","623","622"]),
];

const MAIN_SINGLE_ROWS = [
  ...row(["637","638","639","640","641","642","643"], MAIN_X, MAIN_Y + 5 * MSTEP_Y, MCW, MCH, 1),
  ...row(["644","645","646","647","648","649"], MAIN_X + 7 * (MCW + 1) + 28, MAIN_Y + 5 * MSTEP_Y, MCW, MCH, 1),
];

const MAIN_MID_Y = MAIN_Y + 6 * MSTEP_Y + 16;
const MAIN_MID_LEFT = [
  ...row(["674","673","672","671","670","668"], MAIN_X, MAIN_MID_Y, MCW, MCH, 1),
  ...row(["675","676","677","678","679","680"], MAIN_X, MAIN_MID_Y + MCH, MCW, MCH, 1),
];
const MAIN_MID_RIGHT_X = MAIN_X + 6 * (MCW + 1) + 52;
const MAIN_MID_RIGHT = [
  ...row(["669","667","666","665","664","663","662"], MAIN_MID_RIGHT_X, MAIN_MID_Y, MCW, MCH, 1),
  ...row(["681","682","683","684","685","686","687"], MAIN_MID_RIGHT_X, MAIN_MID_Y + MCH, MCW, MCH, 1),
];

const MAIN_LOW_X = MAIN_X + 130;
const MAIN_LOW_Y = MAIN_MID_Y + 110;
const MAIN_LCW = 82, MAIN_LCH = 44;
const MAIN_LOWER = [
  ...row(["693","692","691","690","689","688"], MAIN_LOW_X, MAIN_LOW_Y, MAIN_LCW, MAIN_LCH, 0),
  ...row(["694","695","696","697","698","699"], MAIN_LOW_X, MAIN_LOW_Y + MAIN_LCH + 18, MAIN_LCW, MAIN_LCH, 0),
  ...row(["705","704","703","702","701","700"], MAIN_LOW_X, MAIN_LOW_Y + 2 * MAIN_LCH + 18, MAIN_LCW, MAIN_LCH, 0),
  ...row(["706","707","708","709","710","711"], MAIN_LOW_X, MAIN_LOW_Y + 3 * MAIN_LCH + 36, MAIN_LCW, MAIN_LCH, 0),
  ...row(["717","716","715","714","713","712"], MAIN_LOW_X, MAIN_LOW_Y + 4 * MAIN_LCH + 36, MAIN_LCW, MAIN_LCH, 0),
];

const MAIN_GROUND = [
  ...MAIN_TOP,
  ...MAIN_SINGLE_ROWS,
  ...MAIN_MID_LEFT,
  ...MAIN_MID_RIGHT,
  ...MAIN_LOWER,
];

// ── Stall arrays ──────────────────────────────────────────────────────────────
const RIGHT_TOP    = col(["60","59","58","57","56","55","54","53","52","51","50"], RX, RT_Y, SCW, SCH);
const RIGHT_BOTTOM = col(["49","48","47","46","45","44","43","42","41","40"],     RX, RB_Y, SCW, SCH);
const CENTER_TOP_L = col(["195","194","193","192","191","190","189","188"], CCL_X, CT_Y, DCW, DCH, 2);
const CENTER_TOP_R = col(["170","171","172","173","174","175","176","177"], CCR_X, CT_Y, DCW, DCH, 2);
const CENTER_BOT_L = col(["187","186","185","184","183"], CCL_X, CB_Y, DCW, DCH, 2);
const CENTER_BOT_R = col(["178","179","180","181","182"], CCR_X, CB_Y, DCW, DCH, 2);

const STALLS: StallPlacement[] = [
  ...LEFT_TOP, ...LEFT_BOTTOM, ...LEFT_ROW,
  ...RIGHT_TOP, ...RIGHT_BOTTOM,
  ...CENTER_TOP_L, ...CENTER_TOP_R,
  ...CENTER_BOT_L, ...CENTER_BOT_R,
  ...BOTTOM_LEFT, ...BOTTOM_RIGHT,
  ...MAIN_GROUND,
];

// ── Wall geometry (derived from stall positions) ──────────────────────────────
// Left section bottom (below row 36–40): HR_Y + BRH + 6
const LEFT_SEC_BOT = HR_Y + BRH + 8;   // 604
// Right inner wall x (left edge of lift/stair zone beside right col)
const R_INNER_X = RX - 14;             // 948
// Bottom of floor plan wall
// Left lift notch inner-right x
const liftNotchL = WALL_L + 2 + 30;    // 52

// ─── Sub-components ───────────────────────────────────────────────────────────

function BlueprintTile({ placement, stall, onEdit, onSelect }: {
  placement: StallPlacement;
  stall?: AdminStallRecord;
  onEdit?: (id: string) => void;
  onSelect: (stall: AdminStallRecord | null, stallNum: string) => void;
}) {
  const sk = stall ? normalizeStatus(stall.status) : "unknown";
  const ss = STATUS_STYLES[sk];
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
      <span style={{ fontSize: 12, fontWeight: 700, color: ss.text, lineHeight: 1 }}>
        {placement.num}
      </span>
      <span className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.10)" }} />
    </button>
  );
}

function EmptyTile({ p }: { p: EmptyPlacement }) {
  return (
    <div className="absolute border border-gray-300 bg-gray-100 rounded"
      style={{ left: p.x, top: p.y, width: p.w, height: p.h }} />
  );
}

function Lift({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <div className="absolute flex items-center justify-center border-2 border-gray-800 bg-white text-[11px] font-black text-gray-800 tracking-widest rounded-sm"
      style={{ left: x, top: y, width: w, height: h }}>
      LIFT
    </div>
  );
}

function StairBox({ x, y, w, h, dir = "down" }: { x: number; y: number; w: number; h: number; dir?: "down" | "left" | "right" | "up" }) {
  const arrow = { down: "▼", up: "▲", left: "◀", right: "▶" }[dir];
  return (
    <div className="absolute border border-gray-500 bg-white rounded-sm overflow-hidden"
      style={{
        left: x, top: y, width: w, height: h,
        backgroundImage: "repeating-linear-gradient(0deg,transparent 0,transparent 5px,#e5e7eb 5px,#e5e7eb 6px)",
      }}>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-black text-gray-500 select-none">{arrow}</span>
    </div>
  );
}

function Walls() {
  // The floor plan outline is a closed polygon.
  // Outer shape:
  //   - Starts top-left (WALL_L, WALL_T)
  //   - Goes right to WALL_R
  //   - Down to WALL_B
  //   - Left to step-x (right edge of left section bottom)
  //   - Up to LEFT_SEC_BOT
  //   - Left back to WALL_L
  //   - Up with left-lift notch to WALL_T
  //
  // Left lift notch: the wall indents right (by ~30px) between LIFT_L_Y and LIFT_L_Y+LIFT_H

  const stepX        = HR_X0 + 5 * (BRW + 2) + 6;  // right edge of row 36–40 + gap ≈ 352
  const notchX       = LX - PAD + 2;                 // slight indent for lift area ≈ 22
  const wallLiftNotchX = notchX + 30;                // left edge of lift zone inner wall ≈ 52

  // Right: stair box sits outside the main stall column (to its right)
  // The outer wall on the right contains both the stalls and the lift/stair box
  // so WALL_R is already the outer right boundary.

  return (
    <svg className="absolute inset-0 pointer-events-none" fill="none"
      height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} width={CANVAS_W}>

      {/* ── Main floor-plan outline ─────────────────────────────── */}
      <path stroke="#1f2937" strokeWidth="2.5"
        d={[
          `M ${WALL_L} ${WALL_T}`,          // top-left corner
          `H ${WALL_R}`,                      // top edge →
          `V ${WALL_B}`,                      // right edge ↓
          `H ${stepX}`,                       // bottom edge ←  (to step)
          `V ${LEFT_SEC_BOT}`,                // step up ↑
          `H ${WALL_L}`,                      // inner bottom edge ←
          `V ${LIFT_L_Y + LIFT_H}`,           // left wall ↑ to lift-bottom
          `H ${wallLiftNotchX}`,              // notch right →
          `V ${LIFT_L_Y}`,                    // notch up ↑
          `H ${WALL_L}`,                      // notch back left ←
          `Z`,                                // close to WALL_T
        ].join(" ")}
      />

      {/* ── Left — stair wing top (column right of stall 12) ────── */}
      <path stroke="#1f2937" strokeWidth="1.5"
        d={[
          `M ${LX + SCW + 2} ${WALL_T}`,
          `V ${LT_Y + 6 * SIDE_STEP}`,
        ].join(" ")}
      />
      {/* Stair box outline top-left */}
      <rect fill="none" height={LIFT_H} rx={2} stroke="#1f2937" strokeWidth="1.5"
        width={54} x={LX + SCW + 4} y={LT_Y}
      />

      {/* ── Left — small stair nub (beside row 36) ──────────────── */}
      <rect fill="none" height={BRH + 4} rx={2} stroke="#1f2937" strokeWidth="1.5"
        width={26} x={LX + SCW + 2} y={HR_Y - 2}
      />

      {/* ── Right — stair box top ────────────────────────────────── */}
      <rect fill="none" height={32} rx={2} stroke="#1f2937" strokeWidth="1.5"
        width={RIGHT_AUX_W} x={RIGHT_AUX_X} y={WALL_T}
      />
      {/* Vertical connector from stair box to lift zone */}
      <path stroke="#1f2937" strokeWidth="1.5"
        d={`M ${RIGHT_AUX_X} ${WALL_T + 32} V ${LIFT_R_Y}`}
      />

      {/* ── Right — inner wall (left side of right lift zone) ────── */}
      <path stroke="#1f2937" strokeWidth="1.5"
        d={`M ${R_INNER_X} ${LIFT_R_Y} V ${WALL_B}`}
      />
      {/* Horizontal caps of right lift zone */}
      <path stroke="#1f2937" strokeWidth="1.5"
        d={`M ${R_INNER_X} ${LIFT_R_Y} H ${WALL_R}`}
      />
      <path stroke="#1f2937" strokeWidth="1.5"
        d={`M ${R_INNER_X} ${LIFT_R_Y + LIFT_H} H ${WALL_R}`}
      />

      {/* ── Bottom — stair gap between 243 and 245 ───────────────── */}
      <rect fill="none" height={BRH + 4} rx={2} stroke="#1f2937" strokeWidth="1.5"
        width={BOT_STAIR_W}
        x={BOT_STAIR_X}
        y={BOT_Y - 2}
      />
    </svg>
  );
}

function PlanLabel() {
  return (
    <div className="absolute left-6 top-2">
      <div className="text-[11px] font-bold tracking-[0.14em] text-[#0b2a5b] uppercase">
        Ground Floor Plan
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 pt-2.5 pb-3 border-t border-gray-100 bg-white">
      {(Object.entries(STATUS_STYLES) as [StatusKey, typeof STATUS_STYLES[StatusKey]][]).map(([, s]) => (
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

// ── ADD NEW VENDOR modal ──────────────────────────────────────────────────────
function StallModal({ stall, stallNum, onClose }: {
  stall: AdminStallRecord | null;
  stallNum: string;
  onEdit?: (id: string) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const displayName = stall ? stall.stall : `Stall ${stallNum}`;

  const [form, setForm] = useState({
    vendorName: "",
    email: "",
    phone: "",
    stallType: stall?.type || "",
    monthlyRent: String(stall?.rate || ""),
    leaseStart: "",
    leaseEnd: "",
    status: "Occupied",
    paymentStatus: "Paid",
    vendorPassword: "",
  });

  const f = <K extends keyof typeof form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      if (!stall) return Promise.reject(new Error("Stall record not found in database."));
      const stallRecord = stall;
      return saveStall(user!.id, {
        stallId: stallRecord.id,
        sectionId: stallRecord.sectionId,
        stallNumber: stallRecord.stallNumber,
        stallType: form.stallType,
        monthlyRate: Number(form.monthlyRent),
        status: form.status,
        notes: stallRecord.notes,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-stalls"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard-live"] }),
      ]);
      toast.success(`Vendor added to ${displayName}`);
      onClose();
    },
    onError: (e) => toast.error(String(e)),
  });

  const canSave = form.vendorName && form.email && form.stallType && form.monthlyRent && form.leaseStart && form.leaseEnd;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 500, maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* ── Header ── */}
        <div className="px-7 pt-6 pb-4 border-b-2 border-[#1e3a8a]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#1e3a8a] tracking-wide">ADD NEW VENDOR</h2>
            <button
              className="text-gray-400 hover:text-gray-600 transition text-xl font-light leading-none"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-7 py-5 overflow-y-auto flex flex-col gap-4">

          {/* Stall Number — pre-filled read-only */}
          <MF label="Stall Number" required>
            <input className={inputCls + " bg-gray-50 text-gray-500 cursor-not-allowed"} readOnly value={displayName} />
          </MF>

          {/* Vendor Name */}
          <MF label="Vendor Name" required>
            <input
              className={inputCls}
              onChange={f("vendorName")}
              placeholder="Full name of vendor"
              type="text"
              value={form.vendorName}
            />
          </MF>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <MF label="Email" required>
              <input
                className={inputCls}
                onChange={f("email")}
                placeholder="email@example.com"
                type="email"
                value={form.email}
              />
            </MF>
            <MF label="Phone" required>
              <input
                className={inputCls}
                onChange={f("phone")}
                placeholder="09XX-XXX-XXXX"
                type="tel"
                value={form.phone}
              />
            </MF>
          </div>

          {/* Stall Type + Monthly Rent */}
          <div className="grid grid-cols-2 gap-3">
            <MF label="Stall Type" required>
              <select className={selectCls} onChange={f("stallType")} value={form.stallType}>
                <option value="">Select type</option>
                <option>General Merchandise</option>
                <option>Fish</option>
                <option>Meat</option>
                <option>Produce</option>
                <option>Dry Goods</option>
                <option>Food Stall</option>
              </select>
            </MF>
            <MF label="Monthly Rent (₱)" required>
              <input
                className={inputCls}
                min="0"
                onChange={f("monthlyRent")}
                placeholder="0.00"
                type="number"
                value={form.monthlyRent}
              />
            </MF>
          </div>

          {/* Lease Start + Lease End */}
          <div className="grid grid-cols-2 gap-3">
            <MF label="Lease Start" required>
              <input className={inputCls} onChange={f("leaseStart")} type="date" value={form.leaseStart} />
            </MF>
            <MF label="Lease End" required>
              <input className={inputCls} onChange={f("leaseEnd")} type="date" value={form.leaseEnd} />
            </MF>
          </div>

          {/* Status */}
          <MF label="Status" required>
            <select className={selectCls} onChange={f("status")} value={form.status}>
              <option>Available</option>
              <option>Occupied</option>
              <option>Reserved</option>
              <option>Under Maintenance</option>
              <option>Inactive</option>
            </select>
          </MF>

          {/* Payment Status */}
          <MF label="Payment Status" required>
            <select className={selectCls} onChange={f("paymentStatus")} value={form.paymentStatus}>
              <option>Paid</option>
              <option>Unpaid</option>
              <option>Overdue</option>
              <option>Partial</option>
            </select>
          </MF>

          {/* Vendor Password */}
          <MF label="Vendor Password" required>
            <input
              className={inputCls}
              onChange={f("vendorPassword")}
              placeholder="Set login password for vendor"
              type="password"
              value={form.vendorPassword}
            />
          </MF>
        </div>

        {/* ── Footer ── */}
        <div className="px-7 py-4 border-t border-gray-100 flex gap-3">
          <button
            className="flex-1 py-3 rounded-lg text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canSave || save.isPending}
            onClick={() => save.mutate()}
            style={{ background: "#1e3a8a" }}
            type="button"
          >
            {save.isPending ? "SAVING…" : "SAVE VENDOR"}
          </button>
          <button
            className="flex-1 py-3 rounded-lg text-sm font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 transition"
            onClick={onClose}
            type="button"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function StallHeatMap({ stalls, onEdit }: StallHeatMapProps) {
  const [modal, setModal] = useState<PanelState | null>(null);

  const stallMap = useMemo(() => {
    const map = new Map<string, AdminStallRecord>();
    for (const s of stalls) map.set(s.stallNumber, s);
    return map;
  }, [stalls]);

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { available: 0, occupied: 0, reserved: 0, under_maintenance: 0, inactive: 0, unknown: 0 };
    for (const p of STALLS) {
      const s = stallMap.get(p.num);
      c[s ? normalizeStatus(s.status) : "unknown"]++;
    }
    return c;
  }, [stallMap]);

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 py-2 border-b border-gray-100 bg-gray-50">
        {(Object.entries(STATUS_STYLES) as [StatusKey, typeof STATUS_STYLES[StatusKey]][])
          .filter(([key]) => key !== "unknown")
          .map(([key, s]) => counts[key] > 0 ? (
            <div className="flex items-center gap-1.5 text-xs" key={key}>
              <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
              <span className="text-gray-600 font-medium">{s.label}</span>
              <span className="font-bold" style={{ color: s.text }}>{counts[key]}</span>
            </div>
          ) : null)}
      </div>

      {/* Scrollable map */}
      <div className="overflow-auto">
        <div className="relative bg-white" style={{ width: CANVAS_W, height: CANVAS_H }}>
          {/* Blank tile below stall 1 */}
          <EmptyTile p={LB_BLANK} />

          {/* All stalls */}
          {STALLS.map((p, i) => (
            <BlueprintTile
              key={`${p.num}-${i}`}
              onEdit={onEdit}
              onSelect={(s, num) => setModal({ stall: s, stallNum: num })}
              placement={p}
              stall={stallMap.get(p.num)}
            />
          ))}
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
