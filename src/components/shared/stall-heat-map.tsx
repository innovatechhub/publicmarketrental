import { useState } from "react";
import type { AdminStallRecord } from "@/integrations/supabase/admin-service";

// ─── Status styling ───────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  available:         { bg: "bg-emerald-50 hover:bg-emerald-100", border: "border-emerald-400", text: "text-emerald-800",  dot: "bg-emerald-500" },
  occupied:          { bg: "bg-rose-50 hover:bg-rose-100",       border: "border-rose-400",    text: "text-rose-800",    dot: "bg-rose-500" },
  reserved:          { bg: "bg-amber-50 hover:bg-amber-100",     border: "border-amber-400",   text: "text-amber-800",   dot: "bg-amber-500" },
  under_maintenance: { bg: "bg-orange-50 hover:bg-orange-100",   border: "border-orange-400",  text: "text-orange-800",  dot: "bg-orange-400" },
  inactive:          { bg: "bg-slate-100 hover:bg-slate-200",    border: "border-slate-300",   text: "text-slate-400",   dot: "bg-slate-400" },
  unknown:           { bg: "bg-slate-50",                        border: "border-dashed border-slate-200", text: "text-slate-300", dot: "bg-slate-200" },
};

function normalizeStatus(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_");
}
function styleFor(status: string) {
  return STATUS_STYLE[normalizeStatus(status)] ?? STATUS_STYLE.unknown;
}

// ─── Cell size constants (px) ─────────────────────────────────────────────────
// Blueprint dims: most stalls are 2×4m or 3×4m. We approximate proportionally.
const S = 36;   // base cell size px (small stall / narrow)
const M = 44;   // medium stall
const L = 56;   // large stall (4m+)
const XL = 72;  // extra large

// ─── Types ───────────────────────────────────────────────────────────────────

// A cell in the grid. null = invisible spacer.
interface Cell {
  num: string | null;
  w?: number; // pixel width
  h?: number; // pixel height
}

// A horizontal row of cells
type GridRow = (Cell | null)[];

// A rectangular block placed at a position in the floor layout
interface Block {
  id: string;
  label: string;
  color: string; // tailwind badge classes
  cellW?: number; // default cell width
  cellH?: number; // default cell height
  rows: GridRow[];
}

// ─── Helper: make a simple row of stall numbers ───────────────────────────────
function r(...nums: (string | null)[]): GridRow {
  return nums.map((n) => (n === null ? null : { num: n }));
}

// ─── GROUND FLOOR – MAIN BUILDING (Page 1) ───────────────────────────────────
//
// Physical layout (top-to-bottom on blueprint):
//
//  ROW 1:  578 575 574 573 572 571  |  570 569 568 567  |  566 565 564 563 562
//  ROW 2:  577 578 579 580 581 582  |  583 584 585 586  |  587 588 589 590 591
//  ROW 3:  606 605 604 603 602 601  |  600 599 598 597  |  596 595 594 593 592
//  ─── corridor ───────────────────────────────────────────────────────────────
//  ROW 4:  607 608 609 610 611 612  |  613 614 615 616  |  617 618 619 620 621
//  ROW 5:  636 635 634 633 632 631  |  630 629 628 627  |  626 625 624 623 622
//  ROW 6:  637 638 639 640 641 642 643  |  644 645 646 647 648
//  ─── canteen / stairway area ─────────────────────────────────────────────────
//  CANTEEN TOP:    665 664 663  |  660 659 658
//  CANTEEN BOT:    666 667 668 669  |  661 662 657 656 655

const GF_MAIN_UPPER: Block = {
  id: "gf_main_upper",
  label: "Ground Floor – Main (Dry Goods, 562–648)",
  color: "bg-amber-100 text-amber-900 border-amber-300",
  cellW: S, cellH: S,
  rows: [
    r("578","575","574","573","572","571", null, "570","569","568","567", null, "566","565","564","563","562"),
    r("577","578","579","580","581","582", null, "583","584","585","586", null, "587","588","589","590","591"),
    r("606","605","604","603","602","601", null, "600","599","598","597", null, "596","595","594","593","592"),
    r(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null), // corridor
    r("607","608","609","610","611","612", null, "613","614","615","616", null, "617","618","619","620","621"),
    r("636","635","634","633","632","631", null, "630","629","628","627", null, "626","625","624","623","622"),
    r("637","638","639","640","641","642","643", null, null, null, null, null, "644","645","646","647","648"),
  ],
};

const GF_MAIN_CANTEEN: Block = {
  id: "gf_main_canteen",
  label: "Ground Floor – Canteen / Wet Market Upper (655–669)",
  color: "bg-blue-100 text-blue-900 border-blue-300",
  cellW: S, cellH: S,
  rows: [
    r(null, null, null, "665","664","663", null, "660","659","658", null, null, null),
    r(null, null, null, "666","667","668","669", null, "661","662","657","656","655"),
  ],
};

// ─── GROUND FLOOR – MAIN LOWER (wet market stalls 670–717) ───────────────────
//
// Blueprint lower section shows two zones:
// A) Narrow paired rows: 670-678 / 679-686 (left), 679-698 (right) — face each other
// B) Large stalls in 3 block pairs:
//    Block1: 688-693 top / 694-699 bot
//    Block2: 700-705 top / 706-711 bot
//    Block3: 712-717 bottom row

const GF_MAIN_LOWER: Block = {
  id: "gf_main_lower",
  label: "Ground Floor – Main (Wet Market Lower, 670–717)",
  color: "bg-cyan-100 text-cyan-900 border-cyan-300",
  cellW: S, cellH: S,
  rows: [
    // Narrow facing rows
    r("670","671","672","673","674","675","676","677","678", null, "688","687","686","685","684","683","682","681","680","679"),
    r("679","678","677","676","675","674","673","672","671", null, "689","690","691","692","693","694","695","696","697","698"),
    r(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null), // aisle
    // Large stalls – 6 wide each, use wider cells
    [
      {num:"693",w:L},{num:"692",w:L},{num:"691",w:L}, null, {num:"690",w:L},{num:"689",w:L},{num:"688",w:L},
    ],
    [
      {num:"694",w:L},{num:"695",w:L},{num:"696",w:L}, null, {num:"697",w:L},{num:"698",w:L},{num:"699",w:L},
    ],
    r(null), // aisle
    [
      {num:"705",w:L},{num:"704",w:L},{num:"703",w:L}, null, {num:"702",w:L},{num:"701",w:L},{num:"700",w:L},
    ],
    [
      {num:"706",w:L},{num:"707",w:L},{num:"708",w:L}, null, {num:"709",w:L},{num:"710",w:L},{num:"711",w:L},
    ],
    r(null),
    [
      {num:"717",w:L},{num:"716",w:L},{num:"715",w:L}, null, {num:"714",w:L},{num:"713",w:L},{num:"712",w:L},
    ],
  ],
};

// ─── SECOND FLOOR – MAIN BUILDING (Page 2) ───────────────────────────────────
//
// Large stalls (4×4m+). Blueprint shows:
// Left column (tall): 740, 741, 742, 743, 744
// Middle columns: 738 (tall), 739/730/731/734 cluster
// Right column (narrow 2m): 718,719,720,721,722,723,724,725,726,727,728,729
// Stair area: 751, 752
// Lower cluster: 745,746,747,748 / 749,750
// Long bottom row: 753–782

const SF_MAIN: Block = {
  id: "sf_main",
  label: "Second Floor – Main Building (718–782)",
  color: "bg-violet-100 text-violet-900 border-violet-300",
  cellW: M, cellH: M,
  rows: [
    // Right-side narrow stalls + tall left stalls
    [{num:"740",w:XL,h:XL*2}, null, {num:"738",w:XL,h:XL*2}, null, {num:"739",w:XL,h:XL*2}, null, null, null, {num:"718",w:M},{num:"719",w:M}],
    [null,                     null, null,                    null, null,                    null, null, null, {num:"720",w:M},{num:"721",w:M}],
    [{num:"741",w:XL,h:XL*2}, null, {num:"730",w:XL,h:XL*2},null, {num:"731",w:XL,h:XL*2},null, null, null, {num:"722",w:M},{num:"723",w:M}],
    [null,                     null, null,                    null, null,                    null, null, null, {num:"724",w:M},{num:"725",w:M}],
    [{num:"742",w:XL,h:XL*2}, null, {num:"734",w:XL,h:XL*2},null, null,                    null, null, null, {num:"726",w:M},{num:"727",w:M}],
    [null,                     null, null,                    null, null,                    null, null, null, {num:"728",w:M},{num:"729",w:M}],
    [{num:"743",w:XL,h:XL*2}, null, null,                    null, null,                    null, null, null, {num:"751",w:M},{num:"752",w:M}],
    [null,                     null, null,                    null, null,                    null, null, null, null,             null           ],
    [{num:"744",w:XL,h:XL*2}, null, {num:"745",w:XL},{num:"746",w:XL},{num:"747",w:XL},{num:"748",w:XL}, null, null, null, null],
    [null,                     null, {num:"749",w:XL},{num:"750",w:XL}, null,               null, null, null, null,             null           ],
    // Long bottom row 753–782
    ...Array.from({length:30},(_,i)=>[{num:String(753+i),w:M}]),
  ],
};

// ─── GROUND FLOOR – ANNEX (Page 3) ───────────────────────────────────────────
//
// Blueprint shows an L-shaped plan:
//  • Left wing:   stalls 12→1 running top-to-bottom along north wall, stall 751 at stairway
//  • Bottom-left: stalls 35→39 horizontal at the foot of left wing
//  • Right wing:  stalls 62→40 running top-to-bottom along east wall (long column)
//  • Center grid: stalls 100–120 in paired columns
//  • Bottom row:  stalls 240–248

const GF_ANNEX_LEFT: Block = {
  id: "gf_annex_left",
  label: "Annex GF – Left Wing (1–12)",
  color: "bg-green-100 text-green-900 border-green-300",
  cellW: M, cellH: S,
  rows: [
    r("12"), r("11"), r("10"), r("9"), r("8"), r("7"),
    r("751"), // stairway landing
    r("6"), r("5"), r("4"), r("3"), r("2"), r("1"),
  ],
};

const GF_ANNEX_BOTTOM_LEFT: Block = {
  id: "gf_annex_btm_left",
  label: "Annex GF – Stalls 35–39",
  color: "bg-green-100 text-green-900 border-green-300",
  cellW: M, cellH: S,
  rows: [r("35","36","37","38","39")],
};

const GF_ANNEX_RIGHT: Block = {
  id: "gf_annex_right",
  label: "Annex GF – Right Wing (40–62)",
  color: "bg-teal-100 text-teal-900 border-teal-300",
  cellW: M, cellH: S,
  rows: [
    r("62"),r("61"),r("60"),r("59"),r("58"),r("57"),r("56"),r("55"),r("54"),
    r("53"),r("52"),r("51"),r("50"),r("49"),r("48"),r("47"),r("46"),r("45"),
    r("44"),r("43"),r("42"),r("41"),r("40"),
  ],
};

const GF_ANNEX_CENTER: Block = {
  id: "gf_annex_center",
  label: "Annex GF – Center (100–120)",
  color: "bg-teal-100 text-teal-900 border-teal-300",
  cellW: S, cellH: S,
  rows: [
    r("114","113", null, "110","109", null, "104","103", null, "100"),
    r("115","116", null, "111","112", null, "105","106", null, "101"),
    r("118","117", null, null,  null,  null, "107","108", null, "102"),
    r("119","120"),
  ],
};

const GF_ANNEX_BOTTOM: Block = {
  id: "gf_annex_bottom",
  label: "Annex GF – Bottom Row (240–248)",
  color: "bg-green-100 text-green-900 border-green-300",
  cellW: M, cellH: S,
  rows: [r("240","241","242","243","244", null, "245","246","247","248")],
};

// ─── SECOND FLOOR – ANNEX (Page 4) ───────────────────────────────────────────
//
// Mirror of annex GF shape:
//  • Left wing:  13→24 top-to-bottom
//  • Right wing: 86→63 top-to-bottom
//  • Centre: large FUNCTION HALL (non-stall)
//  • Bottom row: 249–258

const SF_ANNEX_LEFT: Block = {
  id: "sf_annex_left",
  label: "Annex 2F – Left Wing (13–24)",
  color: "bg-purple-100 text-purple-900 border-purple-300",
  cellW: M, cellH: S,
  rows: [
    r("13"),r("14"),r("15"),r("16"),r("17"),r("18"),
    r("19"),r("20"),r("21"),r("22"),r("23"),r("24"),
  ],
};

const SF_ANNEX_RIGHT: Block = {
  id: "sf_annex_right",
  label: "Annex 2F – Right Wing (63–86)",
  color: "bg-purple-100 text-purple-900 border-purple-300",
  cellW: M, cellH: S,
  rows: [
    r("86"),r("85"),r("84"),r("83"),r("82"),r("81"),r("80"),r("79"),r("78"),
    r("77"),r("76"),r("75"),r("74"),r("73"),r("72"),r("71"),r("70"),r("69"),
    r("68"),r("67"),r("66"),r("65"),r("64"),r("63"),
  ],
};

const SF_ANNEX_BOTTOM: Block = {
  id: "sf_annex_bottom",
  label: "Annex 2F – Bottom Row (249–258)",
  color: "bg-purple-100 text-purple-900 border-purple-300",
  cellW: M, cellH: S,
  rows: [r("249","250","251","252","253","254","255","256","257","258")],
};

// ─── MIXED SECTION (Page 5) ───────────────────────────────────────────────────
//
// Blueprint shows paired rows (top read right-to-left, bottom left-to-right).
// Each pair shares a back wall. The columns are read from the PDF:
//
// Pair A:  [top]  370 369 368 367 366 365 364 363 362 361 360 359
//          [bot]  371 372 373 374 375 376 377 378 379 380 381
// Pair B:  [top]  396 395 394 393 392 391 390 389 388 387 386 385 384 383 382
//          [bot]  397 398 399 400 401 402 403 404 405 406 407 408 409 410 411
// Pair C:  [top]  435 434 433 432 431 430 429 428 427 426 425 424 423 422 421 420 419 418 417 416 415 414
//          [bot]  436 437 438 439 440 441 442 443 444 445 446 447 448 449 450 451 452 453 454 455 456 413
// Pair D:  [top]  477 476 475 474 473 472 471 470 469 468 467 466 465 464 463 462 461 460 459 458 457
//          [bot]  478 479 480 481 482 483 484 485 486 487 488 489 490 491 492 493 494 495 496 497 498 499
// Pair E:  [top]  519 518 517 516 515 514 513 512 511 510 509 508 507 506 505 504 503 502 501 500
//          [bot]  520 521 522 523 524 525 526 527 528 529 530 531 532 533 534 535 536 537 538 539 540
// Pair F:  [top]  561 560 559 558 557 556 555 554 553 552 551 550 549 548 547 546 545 544 543 542 541
//          [bot]  (none – single row)

const MIXED: Block = {
  id: "mixed_section",
  label: "Mixed Section (359–561)",
  color: "bg-rose-100 text-rose-900 border-rose-300",
  cellW: S, cellH: S,
  rows: [
    // Pair A
    r(null,null,null,null,null,null,null,null,null,null,"370","369","368","367","366","365","364","363","362","361","360","359"),
    r(null,null,null,null,null,null,null,null,null,null,null,"371","372","373","374","375","376","377","378","379","380","381"),
    // Pair B
    r(null,null,null,null,null,null,null,"396","395","394","393","392","391","390","389","388","387","386","385","384","383","382"),
    r(null,null,null,null,null,null,null,null,"397","398","399","400","401","402","403","404","405","406","407","408","409","410"),
    // Pair C
    r("435","434","433","432","431","430","429","428","427","426","425","424","423","422","421","420","419","418","417","416","415","414"),
    r("436","437","438","439","440","441","442","443","444","445","446","447","448","449","450","451","452","453","454","455","456","413"),
    // Pair D
    r("477","476","475","474","473","472","471","470","469","468","467","466","465","464","463","462","461","460","459","458","457",null),
    r("478","479","480","481","482","483","484","485","486","487","488","489","490","491","492","493","494","495","496","497","498","499"),
    // Pair E
    r(null,"519","518","517","516","515","514","513","512","511","510","509","508","507","506","505","504","503","502","501","500",null),
    r(null,"520","521","522","523","524","525","526","527","528","529","530","531","532","533","534","535","536","537","538","539","540"),
    // Pair F
    r(null,"561","560","559","558","557","556","555","554","553","552","551","550","549","548","547","546","545","544","543","542","541"),
  ],
};

// ─── Floor layout descriptors ─────────────────────────────────────────────────
// Each floor is an array of "rows" of blocks to render side-by-side.
// A FloorRow entry is either a Block or a spacer string ("SPACE").

type FloorRow = (Block | "SPACE" | "HALL")[];

const GROUND_FLOOR: FloorRow[] = [
  // Main building top section
  [GF_MAIN_UPPER],
  ["SPACE"],
  [GF_MAIN_CANTEEN],
  ["SPACE"],
  [GF_MAIN_LOWER],
  ["SPACE"],
  // Annex: left wing | open yard | right wing — side by side
  [GF_ANNEX_LEFT, "SPACE", GF_ANNEX_CENTER, "SPACE", GF_ANNEX_RIGHT],
  [GF_ANNEX_BOTTOM_LEFT],
  ["SPACE"],
  [GF_ANNEX_BOTTOM],
  ["SPACE"],
  [MIXED],
];

const SECOND_FLOOR: FloorRow[] = [
  [SF_MAIN],
  ["SPACE"],
  // Annex: left wing | function hall | right wing
  [SF_ANNEX_LEFT, "HALL", SF_ANNEX_RIGHT],
  ["SPACE"],
  [SF_ANNEX_BOTTOM],
];

// ─── Stall cell ───────────────────────────────────────────────────────────────

interface TooltipState {
  stall: AdminStallRecord;
  x: number;
  y: number;
}

function StallTile({
  cell,
  stallMap,
  onEdit,
  onHover,
  onLeave,
  defaultW,
  defaultH,
}: {
  cell: Cell;
  stallMap: Map<string, AdminStallRecord>;
  onEdit?: (id: string) => void;
  onHover: (e: React.MouseEvent, r: AdminStallRecord) => void;
  onLeave: () => void;
  defaultW: number;
  defaultH: number;
}) {
  if (cell.num === null) {
    return <div style={{ width: cell.w ?? defaultW, height: cell.h ?? defaultH, flexShrink: 0 }} />;
  }
  const record = stallMap.get(cell.num);
  const s = record ? styleFor(record.status) : STATUS_STYLE.unknown;
  const w = cell.w ?? defaultW;
  const h = cell.h ?? defaultH;

  return (
    <button
      type="button"
      onClick={() => record && onEdit?.(record.id)}
      onMouseEnter={(e) => record && onHover(e, record)}
      onMouseLeave={onLeave}
      style={{ width: w, height: h, flexShrink: 0 }}
      className={`
        relative flex items-center justify-center rounded border
        text-[8px] font-bold leading-tight transition-all duration-100 select-none
        ${s.bg} ${s.border} ${s.text}
        ${record && onEdit ? "cursor-pointer" : "cursor-default"}
      `}
      title={record ? `${record.stall} — ${record.status}` : `Stall ${cell.num} (no data)`}
    >
      <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className="text-center px-0.5 leading-none">{cell.num}</span>
    </button>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function BlockRenderer({
  block,
  stallMap,
  onEdit,
  onHover,
  onLeave,
}: {
  block: Block;
  stallMap: Map<string, AdminStallRecord>;
  onEdit?: (id: string) => void;
  onHover: (e: React.MouseEvent, r: AdminStallRecord) => void;
  onLeave: () => void;
}) {
  const dw = block.cellW ?? S;
  const dh = block.cellH ?? S;

  return (
    <div className="flex flex-col gap-0">
      {/* Badge */}
      <div className={`mb-1 self-start inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${block.color}`}>
        {block.label}
      </div>
      {/* Rows */}
      {block.rows.map((row, ri) => {
        // Detect corridor row (all nulls)
        const allNull = row.every((c) => c === null);
        if (allNull) {
          return <div key={ri} className="h-3 border-t border-dashed border-slate-200 my-0.5" />;
        }
        return (
          <div key={ri} className="flex gap-0.5 mb-0.5">
            {row.map((cell, ci) => {
              if (cell === null) {
                return <div key={ci} style={{ width: dw, height: dh, flexShrink: 0 }} />;
              }
              return (
                <StallTile
                  key={ci}
                  cell={cell}
                  stallMap={stallMap}
                  onEdit={onEdit}
                  onHover={onHover}
                  onLeave={onLeave}
                  defaultW={dw}
                  defaultH={dh}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Floor renderer ───────────────────────────────────────────────────────────

function FloorRenderer({
  rows,
  stallMap,
  onEdit,
  onHover,
  onLeave,
}: {
  rows: FloorRow[];
  stallMap: Map<string, AdminStallRecord>;
  onEdit?: (id: string) => void;
  onHover: (e: React.MouseEvent, r: AdminStallRecord) => void;
  onLeave: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {rows.map((row, ri) => {
        // Single SPACE separator
        if (row.length === 1 && row[0] === "SPACE") {
          return <div key={ri} className="border-t border-border/40" />;
        }

        return (
          <div key={ri} className="flex items-start gap-6 flex-wrap">
            {row.map((item, ii) => {
              if (item === "SPACE") {
                return <div key={ii} className="w-8 shrink-0" />;
              }
              if (item === "HALL") {
                return (
                  <div
                    key={ii}
                    className="flex items-center justify-center rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 text-purple-400 text-sm font-semibold"
                    style={{ minWidth: 180, minHeight: 200 }}
                  >
                    Function Hall
                  </div>
                );
              }
              return (
                <BlockRenderer
                  key={item.id}
                  block={item}
                  stallMap={stallMap}
                  onEdit={onEdit}
                  onHover={onHover}
                  onLeave={onLeave}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface StallHeatMapProps {
  stalls: AdminStallRecord[];
  onEdit?: (id: string) => void;
}

export function StallHeatMap({ stalls, onEdit }: StallHeatMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [activeFloor, setActiveFloor] = useState<"ground" | "second">("ground");

  const stallMap = new Map<string, AdminStallRecord>();
  for (const s of stalls) stallMap.set(s.stallNumber, s);

  const counts = stalls.reduce<Record<string, number>>((acc, s) => {
    const k = normalizeStatus(s.status);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  function handleHover(e: React.MouseEvent, record: AdminStallRecord) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ stall: record, x: rect.left, y: rect.bottom + 8 });
  }

  const floorRows = activeFloor === "ground" ? GROUND_FLOOR : SECOND_FLOOR;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 shadow-soft overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-6 py-4">
        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
          {([
            { key: "ground", label: "Ground Floor" },
            { key: "second", label: "Second Floor" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`px-4 py-2 transition-colors ${activeFloor === key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveFloor(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {[
            { key: "available",         label: "Available" },
            { key: "occupied",          label: "Occupied" },
            { key: "reserved",          label: "Reserved" },
            { key: "under_maintenance", label: "Maintenance" },
            { key: "inactive",          label: "Inactive" },
          ].map(({ key, label }) => {
            const s = STATUS_STYLE[key];
            return (
              <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`h-3 w-3 rounded-sm border ${s.border} ${s.bg.split(" ")[0]}`} />
                {label}
                {counts[key] ? <span className="ml-0.5 font-semibold text-foreground">{counts[key]}</span> : null}
              </span>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div className="overflow-auto p-6">
        <div className="min-w-max">
          <FloorRenderer
            rows={floorRows}
            stallMap={stallMap}
            onEdit={onEdit}
            onHover={handleHover}
            onLeave={() => setTooltip(null)}
          />
        </div>
      </div>

      {/* Tooltip */}
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 min-w-[180px] max-w-[220px] rounded-xl border border-border bg-popover px-4 py-3 shadow-xl text-sm"
          style={{ left: Math.min(tooltip.x, window.innerWidth - 240), top: tooltip.y }}
        >
          <p className="font-semibold text-foreground">{tooltip.stall.stall}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{tooltip.stall.section} · {tooltip.stall.type || "—"}</p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-medium text-foreground">₱{tooltip.stall.rate.toLocaleString()}/mo</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${styleFor(tooltip.stall.status).text}`}>{tooltip.stall.status}</span>
            </div>
            {tooltip.stall.notes ? (
              <div className="pt-1 border-t border-border text-muted-foreground leading-snug">{tooltip.stall.notes}</div>
            ) : null}
          </div>
          {onEdit ? <p className="mt-2 text-[10px] text-primary font-medium">Click to edit</p> : null}
        </div>
      ) : null}
    </div>
  );
}
