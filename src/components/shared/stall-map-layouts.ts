// Stall positions for each sheet of the market stall map.
// Sheets follow the orientation of the printed floor plans.

export interface StallPlacement { num: string; x: number; y: number; w: number; h: number }
export interface BlockPlacement { label?: string; x: number; y: number; w: number; h: number }
export interface MapSheet {
  id: string;
  label: string;
  width: number;
  height: number;
  stalls: StallPlacement[];
  blocks?: BlockPlacement[];
}

function col(nums: string[], x: number, y0: number, w: number, h: number, gap = 1): StallPlacement[] {
  return nums.map((num, i) => ({ num, x, y: y0 + i * (h + gap), w, h }));
}
function row(nums: string[], x0: number, y: number, w: number, h: number, gap = 2): StallPlacement[] {
  return nums.map((num, i) => ({ num, x: x0 + i * (w + gap), y, w, h }));
}
// Consecutive stall numbers, ascending or descending: seq(12, 7) → "12" … "7"
function seq(from: number, to: number): string[] {
  const step = from <= to ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => String(from + i * step));
}

// ── Annex building (shared by ground and second floor) ───────────────────────
// Side columns: W=50, H=24.  Centre double columns: W=38, H=20.  Bottom row: W=28, H=24.
const SCW = 50, SCH = 24;
const DCW = 38, DCH = 20;
const BRW = 28, BRH = 24;
const SIDE_STEP = SCH + 1;
const CENTER_STEP = DCH + 2;
const BOTTOM_STEP = BRW + 2;
const STAIR_GAP = 48;

const LX = 39;                                       // left column
const LT_Y = 48;
const LEFT_GAP_Y = LT_Y + 6 * SIDE_STEP + 18;        // stair gap between the two left blocks
const LB_Y = LEFT_GAP_Y + STAIR_GAP + 6;
const HR_Y = LB_Y + 6 * SIDE_STEP + 2;               // row beside the bottom of the left column
const HR_X0 = LX + SCW + 3;

const RX = 499;                                      // right column
const RT_Y = 55;
const RB_Y = RT_Y + 13 * SIDE_STEP + 12 + STAIR_GAP + 12;

const BOT_Y = 516;                                   // bottom row, right-aligned just left of the right column
const BOT_X_END = 490;
const BOT_STAIR_W = 34;

const ANNEX_W = 580;
const ANNEX_H = RB_Y + 10 * SIDE_STEP + 18;

function annexWings(
  leftTop: string[], leftBottom: string[],
  rightTop: string[], rightBottom: string[],
  bottomLeft: string[], bottomRight: string[],
): StallPlacement[] {
  const botRightX = BOT_X_END - bottomRight.length * BOTTOM_STEP;
  const botLeftX = botRightX - BOT_STAIR_W - bottomLeft.length * BOTTOM_STEP;
  return [
    ...col(leftTop, LX, LT_Y, SCW, SCH),
    ...col(leftBottom, LX, LB_Y, SCW, SCH),
    ...col(rightTop, RX, RT_Y, SCW, SCH),
    ...col(rightBottom, RX, RB_Y, SCW, SCH),
    ...row(bottomLeft, botLeftX, BOT_Y, BRW, BRH),
    ...row(bottomRight, botRightX, BOT_Y, BRW, BRH),
  ];
}

const CT_Y = 166;
const CB_Y = CT_Y + 8 * CENTER_STEP + 22;
const CCL_X = 340;
const CCR_X = CCL_X + DCW + 2;

const ANNEX_GROUND: StallPlacement[] = [
  ...annexWings(seq(12, 7), seq(6, 1), seq(62, 50), seq(49, 40), seq(240, 244), seq(245, 248)),
  ...row(seq(35, 39), HR_X0, HR_Y, BRW, BRH),
  { num: "751", x: LX, y: LEFT_GAP_Y + 6, w: SCW, h: SCH },   // beside the stairs between 7 and 6
  ...col(seq(195, 188), CCL_X, CT_Y, DCW, DCH, 2),
  ...col(seq(170, 177), CCR_X, CT_Y, DCW, DCH, 2),
  ...col(seq(187, 183), CCL_X, CB_Y, DCW, DCH, 2),
  ...col(seq(178, 182), CCR_X, CB_Y, DCW, DCH, 2),
];

const ANNEX_SECOND: StallPlacement[] =
  annexWings(seq(13, 18), seq(19, 24), seq(85, 73), seq(72, 63), seq(258, 253), seq(252, 249));

// ── Main building, ground floor ──────────────────────────────────────────────
const MAIN_X = 740;
const MAIN_Y = 48;
const MCW = 46, MCH = 30;
const MSTEP_Y = MCH + 34;
const MAIN_GAP_1 = 32;
const MAIN_GAP_2 = 42;

function mainRow(y: number, left: string[], middle: string[], right: string[]): StallPlacement[] {
  const middleX = MAIN_X + left.length * (MCW + 1) + MAIN_GAP_1;
  const rightX = middleX + middle.length * (MCW + 1) + MAIN_GAP_2;
  return [
    ...row(left, MAIN_X, y, MCW, MCH, 1),
    ...row(middle, middleX, y, MCW, MCH, 1),
    ...row(right, rightX, y, MCW, MCH, 1),
  ];
}

const MAIN_SINGLE_Y = MAIN_Y + 5 * MSTEP_Y;
const MAIN_BLOCK_X = MAIN_X + 248;                   // 650–661, between the two stair cores
const MAIN_BLOCK_Y = MAIN_SINGLE_Y + MCH + 20;
const MAIN_MID_Y = MAIN_BLOCK_Y + 2 * MCH + 20;
const MAIN_MID_RIGHT_X = MAIN_X + 6 * (MCW + 1) + 52;
const MAIN_LOW_X = MAIN_X + 130;
const MAIN_LOW_Y = MAIN_MID_Y + 110;
const MAIN_LCW = 82, MAIN_LCH = 44;

const MAIN_GROUND: StallPlacement[] = [
  ...mainRow(MAIN_Y + 0 * MSTEP_Y, seq(576, 571), seq(570, 567), seq(566, 562)),
  ...mainRow(MAIN_Y + 1 * MSTEP_Y, seq(577, 582), seq(583, 586), seq(587, 591)),
  ...mainRow(MAIN_Y + 2 * MSTEP_Y, seq(606, 601), seq(600, 597), seq(596, 592)),
  ...mainRow(MAIN_Y + 3 * MSTEP_Y, seq(607, 612), seq(613, 616), seq(617, 621)),
  ...mainRow(MAIN_Y + 4 * MSTEP_Y, seq(636, 631), seq(630, 627), seq(626, 622)),
  ...row(seq(637, 643), MAIN_X, MAIN_SINGLE_Y, MCW, MCH, 1),
  ...row(seq(644, 649), MAIN_X + 7 * (MCW + 1) + 28, MAIN_SINGLE_Y, MCW, MCH, 1),
  ...row(seq(655, 650), MAIN_BLOCK_X, MAIN_BLOCK_Y, MCW, MCH, 1),
  ...row(seq(656, 661), MAIN_BLOCK_X, MAIN_BLOCK_Y + MCH, MCW, MCH, 1),
  ...row(seq(674, 669), MAIN_X, MAIN_MID_Y, MCW, MCH, 1),
  ...row(seq(675, 680), MAIN_X, MAIN_MID_Y + MCH, MCW, MCH, 1),
  ...row(seq(668, 662), MAIN_MID_RIGHT_X, MAIN_MID_Y, MCW, MCH, 1),
  ...row(seq(681, 687), MAIN_MID_RIGHT_X, MAIN_MID_Y + MCH, MCW, MCH, 1),
  ...row(seq(693, 688), MAIN_LOW_X, MAIN_LOW_Y, MAIN_LCW, MAIN_LCH, 0),
  ...row(seq(694, 699), MAIN_LOW_X, MAIN_LOW_Y + MAIN_LCH + 18, MAIN_LCW, MAIN_LCH, 0),
  ...row(seq(705, 700), MAIN_LOW_X, MAIN_LOW_Y + 2 * MAIN_LCH + 18, MAIN_LCW, MAIN_LCH, 0),
  ...row(seq(706, 711), MAIN_LOW_X, MAIN_LOW_Y + 3 * MAIN_LCH + 36, MAIN_LCW, MAIN_LCH, 0),
  ...row(seq(717, 712), MAIN_LOW_X, MAIN_LOW_Y + 4 * MAIN_LCH + 36, MAIN_LCW, MAIN_LCH, 0),
];

// ── Mixed section ────────────────────────────────────────────────────────────
// Eight aisles of three runs each, then the 371–396 block and the 370–359 strip.
const XW = 44, XH = 24;
const X_STEP = XH + 1;
const X_Y1 = 40;
const X_Y2 = X_Y1 + 8 * X_STEP + 20;
const X_Y3 = X_Y2 + 7 * X_STEP + 20;

function aisle(i: number, a: string[], b: string[], c: string[]): StallPlacement[] {
  const x = 30 + i * 70;
  return [...col(a, x, X_Y1, XW, XH), ...col(b, x, X_Y2, XW, XH), ...col(c, x, X_Y3, XW, XH)];
}

const MIXED: StallPlacement[] = [
  ...aisle(0, seq(561, 554), seq(553, 547), seq(546, 541)),
  ...aisle(1, seq(520, 527), seq(528, 534), seq(535, 540)),
  ...aisle(2, seq(519, 512), seq(511, 505), seq(504, 499)),
  ...aisle(3, seq(478, 485), seq(486, 492), seq(493, 498)),
  ...aisle(4, seq(477, 470), seq(469, 463), seq(462, 457)),
  ...aisle(5, seq(436, 443), seq(444, 450), seq(451, 456)),
  ...aisle(6, seq(435, 428), seq(427, 421), seq(420, 415)),
  ...aisle(7, seq(397, 404), seq(405, 411), seq(412, 414)),
  ...col(seq(396, 391), 600, X_Y1, XW, XH),
  ...col(seq(371, 373), 646, X_Y1, 60, 49),
  ...col(seq(390, 380), 600, X_Y2, XW, XH),
  ...col(seq(374, 379), 646, X_Y2, 60, 45),
  ...col(seq(370, 359), 730, X_Y1, 70, 46),
];

// ── Main building, second floor ──────────────────────────────────────────────
const MAIN_SECOND: StallPlacement[] = [
  ...col(seq(740, 744), 220, 40, 90, 54),
  ...col(seq(739, 735), 350, 40, 86, 54),
  { num: "729", x: 440, y: 40, w: 80, h: 28 },
  ...col(seq(730, 732), 440, 70, 80, 80, 2),
  { num: "734", x: 350, y: 325, w: 74, h: 70 },
  { num: "733", x: 426, y: 325, w: 94, h: 70 },
  ...col(seq(718, 728), 560, 40, 60, 28),
  ...row(seq(745, 748), 270, 440, 70, 60, 1),
  { num: "750", x: 270, y: 501, w: 141, h: 60 },
  { num: "749", x: 412, y: 501, w: 141, h: 60 },
];

export const MAP_SHEETS: MapSheet[] = [
  {
    id: "ground",
    label: "Ground Floor",
    width: 1580,
    height: MAIN_LOW_Y + 5 * MAIN_LCH + 36 + 24,
    stalls: [...ANNEX_GROUND, ...MAIN_GROUND],
    blocks: [{ x: LX, y: HR_Y, w: SCW, h: SCH }],   // blank tile below stall 1
  },
  {
    id: "annex-second",
    label: "Annex 2nd Floor",
    width: ANNEX_W,
    height: ANNEX_H,
    stalls: ANNEX_SECOND,
    blocks: [{ label: "Function Hall", x: HR_X0, y: LB_Y + 4 * SIDE_STEP, w: 150, h: 2 * SIDE_STEP - 1 }],
  },
  { id: "mixed", label: "Mixed Section", width: 830, height: X_Y3 + 6 * X_STEP + 30, stalls: MIXED },
  { id: "main-second", label: "Main 2nd Floor", width: 660, height: 600, stalls: MAIN_SECOND },
];
