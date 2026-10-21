"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RotateCcw } from "lucide-react";

export interface ResizableColumnDef {
  key: string;
  defaultWidth: number;
  minWidth?: number;
}

export interface UseResizableColumnsOptions {
  storageKey: string;
  columns: ResizableColumnDef[];
  onHeaderRefresh?: (colKey: string) => void;
}

function normalizePercentages(weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + Math.max(w, 1), 0) || 100;
  const pcts = weights.map((w) => Number(((Math.max(w, 1) / total) * 100).toFixed(2)));
  const sum = pcts.reduce((s, p) => s + p, 0);
  if (pcts.length > 0 && Math.abs(100 - sum) > 0.001) {
    pcts[pcts.length - 1] = Number((pcts[pcts.length - 1] + (100 - sum)).toFixed(2));
  }
  return pcts;
}

export function useResizableColumns({
  storageKey,
  columns,
  onHeaderRefresh,
}: UseResizableColumnsOptions) {
  const fullStorageKey = `sml_col_pct_v2_${storageKey}`;
  const defaultPcts = useMemo(
    () => normalizePercentages(columns.map((c) => c.defaultWidth)),
    [columns]
  );

  const [pcts, setPcts] = useState<number[]>(defaultPcts);
  const [isCustomized, setIsCustomized] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(fullStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === columns.length) {
          setPcts(normalizePercentages(parsed.map(Number)));
          setIsCustomized(true);
        }
      }
    } catch {
      // ignore localStorage error
    }
  }, [fullStorageKey, columns.length]);

  const pctMap = useMemo(() => {
    const map: Record<string, number> = {};
    columns.forEach((col, i) => {
      map[col.key] = pcts[i] ?? defaultPcts[i] ?? 10;
    });
    return map;
  }, [columns, pcts, defaultPcts]);

  const tableStyle: React.CSSProperties = useMemo(
    () => ({
      width: "100%",
      tableLayout: "fixed",
    }),
    []
  );

  const getColStyle = useCallback(
    (colKey: string): React.CSSProperties => {
      const pct = pctMap[colKey] ?? 10;
      return {
        width: `${pct}%`,
        maxWidth: `${pct}%`,
      };
    },
    [pctMap]
  );

  const startResize = useCallback(
    (colKey: string, e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const colIndex = columns.findIndex((c) => c.key === colKey);
      if (colIndex === -1) return;

      const thEl = (e.currentTarget as HTMLElement).closest("th");
      const tableEl = thEl?.closest("table");
      const tableWidthPx = tableEl?.getBoundingClientRect().width || 1000;
      const startX = e.clientX;
      const startPcts = [...pcts];

      setActiveKey(colKey);
      suppressClickRef.current = true;

      const onMouseMove = (moveEvt: MouseEvent) => {
        const deltaPx = moveEvt.clientX - startX;
        const deltaPct = (deltaPx / tableWidthPx) * 100;
        const neighborIdx = colIndex < columns.length - 1 ? colIndex + 1 : colIndex - 1;
        if (neighborIdx < 0) return;

        const minPct = 4;
        const currentOrig = startPcts[colIndex];
        const neighborOrig = startPcts[neighborIdx];
        const combined = currentOrig + neighborOrig;

        const actualDelta = neighborIdx > colIndex ? deltaPct : -deltaPct;
        const nextCurrent = Math.min(Math.max(currentOrig + actualDelta, minPct), combined - minPct);
        const nextNeighbor = Number((combined - nextCurrent).toFixed(2));

        const updated = [...startPcts];
        updated[colIndex] = Number(nextCurrent.toFixed(2));
        updated[neighborIdx] = nextNeighbor;

        setPcts(normalizePercentages(updated));
        setIsCustomized(true);
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        setActiveKey(null);
        setPcts((latest) => {
          try {
            localStorage.setItem(fullStorageKey, JSON.stringify(latest));
          } catch {
            // ignore
          }
          return latest;
        });
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [columns, pcts, fullStorageKey]
  );

  const resetWidths = useCallback(() => {
    setPcts(defaultPcts);
    setIsCustomized(false);
    try {
      localStorage.removeItem(fullStorageKey);
    } catch {
      // ignore
    }
  }, [defaultPcts, fullStorageKey]);

  const resetColumnWidth = useCallback(
    (_colKey: string) => {
      resetWidths();
    },
    [resetWidths]
  );

  const handleHeaderClick = useCallback(
    (colKey: string) => {
      if (suppressClickRef.current) return;
      onHeaderRefresh?.(colKey);
    },
    [onHeaderRefresh]
  );

  return {
    isCustomized,
    activeKey,
    tableStyle,
    getColStyle,
    startResize,
    resetColumnWidth,
    resetWidths,
    handleHeaderClick,
  };
}

export function ColumnResizeHandle({
  colKey,
  isActive,
  onStartResize,
  onResetColumn,
}: {
  colKey: string;
  isActive: boolean;
  onStartResize: (colKey: string, e: React.MouseEvent<HTMLElement>) => void;
  onResetColumn: (colKey: string) => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e) => onStartResize(colKey, e)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onResetColumn(colKey);
      }}
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize select-none transition-colors ${
        isActive
          ? "bg-emerald-400"
          : "bg-transparent group-hover/th:bg-slate-600/60 hover:!bg-emerald-400"
      }`}
      title="ลากเพื่อปรับความกว้างคอลัมน์ / ดับเบิลคลิกเพื่อรีเซ็ต"
    />
  );
}

export function ResetColumnWidthsButton({
  isCustomized,
  onReset,
  testId = "reset-col-width-btn",
}: {
  isCustomized: boolean;
  onReset: () => void;
  testId?: string;
}) {
  if (!isCustomized) return null;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onReset}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/50 hover:bg-slate-800 hover:text-emerald-300"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      <span>ค่าเริ่มต้น 100%</span>
    </button>
  );
}
