import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const [printing, setPrinting] = useState(false);

  // Printing shows every row, so reports and statements are not cut to one page.
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;

  return {
    rows: printing ? items : items.slice(start, start + pageSize),
    pager: { page: current, pageCount, pageSize, total: items.length, onPageChange: setPage },
  };
}

export function Pagination({ page, pageCount, pageSize, total, onPageChange, className }: PaginationProps) {
  if (total <= pageSize) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground print:hidden", className)}>
      <span>Showing {first}–{last} of {total}</span>
      <div className="flex items-center gap-2">
        <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" type="button" variant="outline">Previous</Button>
        <span>Page {page} of {pageCount}</span>
        <Button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} size="sm" type="button" variant="outline">Next</Button>
      </div>
    </div>
  );
}
