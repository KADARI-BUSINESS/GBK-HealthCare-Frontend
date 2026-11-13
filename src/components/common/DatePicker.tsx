import { useEffect, useRef, useState } from "react";
import "./DatePicker.css";

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  clearable?: boolean;
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function displayDate(value: string) {
  return value ? dateFromKey(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export default function DatePicker({ id, value, onChange, label, placeholder = "Choose date", name, required = false, disabled = false, minDate, maxDate, clearable = false }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = value ? dateFromKey(value) : new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [focusDate, setFocusDate] = useState(value || dateKey(new Date()));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusedDay = useRef<HTMLButtonElement>(null);
  const today = dateKey(new Date());
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(1 - start.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { date, key: dateKey(date) };
  });
  const firstYear = Math.min(new Date().getFullYear() - 100, month.getFullYear());
  const lastYear = Math.max(new Date().getFullYear() + 50, month.getFullYear());

  useEffect(() => {
    if (value) setMonth(new Date(dateFromKey(value).getFullYear(), dateFromKey(value).getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  useEffect(() => {
    if (open) focusedDay.current?.focus();
  }, [open, month, focusDate]);

  const isAllowed = (key: string) => (!minDate || key >= minDate) && (!maxDate || key <= maxDate);
  const choose = (key: string) => {
    if (!isAllowed(key)) return;
    onChange(key);
    setFocusDate(key);
    setOpen(false);
    trigger.current?.focus();
  };

  function moveFocus(key: string, amount: number) {
    const next = dateFromKey(key);
    next.setDate(next.getDate() + amount);
    const nextKey = dateKey(next);
    setFocusDate(nextKey);
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function jumpToMonth(year: number, monthIndex: number) {
    const firstOfMonth = new Date(year, monthIndex, 1);
    setMonth(firstOfMonth);
    const monthLength = new Date(year, monthIndex + 1, 0).getDate();
    const firstAllowed = Array.from({ length: monthLength }, (_, i) => dateKey(new Date(year, monthIndex, i + 1))).find(isAllowed);
    setFocusDate(firstAllowed || dateKey(firstOfMonth));
  }

  return <div className="gbk-date-picker" ref={root}>
    {name && <input type="hidden" name={name} value={value} />}
    <button ref={trigger} id={id} type="button" className={`follow-up-date-trigger${open ? " is-open" : ""}`} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}${required ? ", required" : ""}: ${value ? displayDate(value) : placeholder}`} disabled={disabled} onClick={() => { setFocusDate(value || today); setOpen((current) => !current); }}>
      <span className="follow-up-date-trigger-icon" aria-hidden="true">▦</span>
      <span className={value ? "has-date" : "placeholder-date"}>{value ? displayDate(value) : placeholder}</span>
      <span className="follow-up-date-trigger-action">{open ? "Close" : "Select date"}</span>
    </button>
    {required && !value && <span className="gbk-date-required">Required</span>}
    {open && <div className="follow-up-calendar-popover" role="dialog" aria-label={`Choose ${label}`}>
      <div className="follow-up-calendar-header">
        <button type="button" className="calendar-nav-button" aria-label="Previous month" onClick={() => jumpToMonth(month.getFullYear(), month.getMonth() - 1)}>‹</button>
        <div className="follow-up-calendar-month-selects">
          <select aria-label="Calendar month" value={month.getMonth()} onChange={(event) => jumpToMonth(month.getFullYear(), Number(event.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(2020, i, 1).toLocaleDateString("en-IN", { month: "long" })}</option>)}</select>
          <select aria-label="Calendar year" value={month.getFullYear()} onChange={(event) => jumpToMonth(Number(event.target.value), month.getMonth())}>{Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i).map((year) => <option key={year}>{year}</option>)}</select>
        </div>
        <button type="button" className="calendar-nav-button" aria-label="Next month" onClick={() => jumpToMonth(month.getFullYear(), month.getMonth() + 1)}>›</button>
      </div>
      <p className="follow-up-calendar-helper">Choose a date · Select month and year to jump quickly</p>
      <div className="follow-up-calendar-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="follow-up-calendar-grid" role="grid" aria-label={month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}>
        {days.map(({ date, key }) => {
          const selected = key === value;
          const disabledDay = !isAllowed(key);
          const target = key === focusDate;
          return <button ref={target ? focusedDay : undefined} type="button" key={key} className={["follow-up-calendar-day", date.getMonth() !== month.getMonth() ? "is-outside-month" : "", selected ? "is-selected" : "", key === today ? "is-today" : ""].filter(Boolean).join(" ")} aria-label={date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} aria-pressed={selected} aria-current={key === today ? "date" : undefined} disabled={disabledDay} tabIndex={target ? 0 : -1} onKeyDown={(event) => {
            const keyMoves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date.getDay(), End: 6 - date.getDay(), PageUp: event.shiftKey ? -365 : -new Date(date.getFullYear(), date.getMonth(), 0).getDate(), PageDown: event.shiftKey ? 365 : new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() };
            if (event.key in keyMoves) { event.preventDefault(); moveFocus(key, keyMoves[event.key]); }
          }} onClick={() => choose(key)}>{date.getDate()}</button>;
        })}
      </div>
      <div className="follow-up-calendar-footer"><span>{value ? `Selected: ${displayDate(value)}` : "No date selected"}</span>
        {clearable && value && <button type="button" onClick={() => { onChange(""); setOpen(false); trigger.current?.focus(); }}>Clear</button>}
        <button type="button" disabled={!isAllowed(today)} onClick={() => choose(today)}>Today</button>
      </div>
    </div>}
  </div>;
}
