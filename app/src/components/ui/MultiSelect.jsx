import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdCheck, MdExpandMore, MdSearch } from "react-icons/md";

// Multi-value sibling of Listbox.jsx — same portal/positioning/outside-click
// machinery (copied rather than shared, so a change here can never regress
// the single-select used everywhere else), but `value` is an array and
// picking an option toggles it in/out instead of replacing the value and
// closing. Empty array means "All" — the same convention every filter using
// this already used for a single empty-string value.
//
// `options`: [{ value, label, dot? }]
// `label`: optional prefix shown in the trigger ("Stage", "Source") — the
// trigger then reads "Stage: New" / "Stage · 3" like a SaaS filter button.
export default function MultiSelect({
  value = [],
  onChange,
  options,
  placeholder = "All",
  allLabel,
  label,
  disabled = false,
  className = "",
  buttonClassName = "",
  panelClassName = "",
  align = "left",
  title,
  searchable,
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState(null);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const selectedSet = new Set(value);
  const active = value.length > 0;
  const showSearch = searchable ?? options.length > 7;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
  }, [options, query]);

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const minWidth = Math.max(r.width, 220);
    setPanelPos(
      align === "right"
        ? { top: r.bottom + 6, right: window.innerWidth - r.right, minWidth }
        : { top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - minWidth - 8), minWidth }
    );
  };

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    place();
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e) => {
      const inTrigger = rootRef.current?.contains(e.target);
      const inPanel = e.target?.closest?.('[data-listbox-panel="true"]');
      if (!inTrigger && !inPanel) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    const onScroll = (e) => {
      if (e.target?.closest?.('[data-listbox-panel="true"]')) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (opt) => {
    onChange(
      selectedSet.has(opt.value) ? value.filter((v) => v !== opt.value) : [...value, opt.value]
    );
  };

  const summary = () => {
    if (value.length === 0) return label ? "All" : placeholder;
    if (allLabel && value.length === options.length) return allLabel;
    const first = options.find((o) => o.value === value[0])?.label || placeholder;
    return value.length === 1 ? first : `${first} +${value.length - 1}`;
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((o) => !o);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full flex items-center justify-between gap-2 text-left transition-[border-color,box-shadow,background-color] duration-150 disabled:cursor-not-allowed ${
          buttonClassName ||
          `rounded-lg border shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ${
            active
              ? "border-primary/40 bg-primary-light/50 hover:border-primary/60"
              : "border-gray-300 bg-white hover:border-gray-400"
          } ${open ? "ring-2 ring-primary/20 border-primary" : ""}`
        }`}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          {label && <span className="font-medium text-gray-500 shrink-0">{label}:</span>}
          <span className={`truncate ${active ? "font-semibold text-primary-dark" : "text-gray-800"}`}>
            {summary()}
          </span>
        </span>
        <MdExpandMore
          size={18}
          className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            data-listbox-panel="true"
            role="listbox"
            aria-multiselectable="true"
            style={{ position: "fixed", ...panelPos }}
            className={`z-50 w-max max-w-xs rounded-xl border border-gray-200 bg-white shadow-modal ring-1 ring-black/5 overflow-hidden animate-fade-in ${panelClassName}`}
          >
            {label && (
              <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Filter by {label.toLowerCase()}
              </div>
            )}
            {showSearch && (
              <div className="px-2 pb-1.5 pt-1">
                <div className="relative">
                  <MdSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="Search…"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white"
                  />
                </div>
              </div>
            )}
            <div className="max-h-80 overflow-auto py-1">
              {visible.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-gray-400">No matches</p>
              )}
              {visible.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(o);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                      checked ? "bg-primary-light/40" : "hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 shrink-0 rounded-[5px] border flex items-center justify-center transition-colors ${
                        checked ? "bg-primary border-primary" : "border-gray-300 bg-white"
                      }`}
                    >
                      {checked && <MdCheck size={13} className="text-white" />}
                    </span>
                    {o.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${o.dot}`} />}
                    <span className={`truncate flex-1 ${checked ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {o.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/70 px-3 py-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(options.map((o) => o.value));
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Select all
              </button>
              <button
                type="button"
                disabled={!active}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-xs font-semibold text-primary hover:text-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear{active ? ` (${value.length})` : ""}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
