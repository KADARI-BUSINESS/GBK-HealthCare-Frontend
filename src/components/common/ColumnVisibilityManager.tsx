import { useEffect, useId, useRef, useState } from "react";
import type { TableColumn } from "./columnVisibility";
import "./ColumnVisibilityManager.css";
type Portal = "admin" | "doctor";

type ColumnVisibilityManagerProps = {
  portal: Portal;
  columns: TableColumn[];
  isVisible: (id: string) => boolean;
  visibleCount: number;
  onColumnVisibleChange: (id: string, show: boolean) => void;
  onShowAll: () => void;
  onReset: () => void;
};

export default function ColumnVisibilityManager({
  portal,
  columns,
  isVisible,
  visibleCount,
  onColumnVisibleChange,
  onShowAll,
  onReset,
}: ColumnVisibilityManagerProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`column-visibility column-visibility--${portal}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="column-visibility__trigger"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12" /><path d="M7 3v4M13 8v4M9 13v4" /></svg>
        <span>Columns</span>
        <span className="column-visibility__count">{visibleCount}/{columns.length}</span>
      </button>
      {open && <div id={`${id}-panel`} className="column-visibility__popover" role="dialog" aria-label="Choose visible columns">
        <div className="column-visibility__header"><div><strong>Table columns</strong><small aria-live="polite">{visibleCount} of {columns.length} visible</small></div><button type="button" aria-label="Close columns menu" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>×</button></div>
        <div className="column-visibility__actions"><button type="button" onClick={onShowAll}>Show all</button><button type="button" onClick={onReset}>Reset to default</button></div>
        <div className="column-visibility__options">
          {columns.map((column) => <label className="column-visibility__option" key={column.id}>
            <input type="checkbox" checked={isVisible(column.id)} disabled={column.required} onChange={(event) => onColumnVisibleChange(column.id, event.target.checked)} />
            <span>{column.label}</span>
            {column.required && <small>Required</small>}
          </label>)}
        </div>
      </div>}
    </div>
  );
}
