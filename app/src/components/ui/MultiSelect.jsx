import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdCheckBox, MdCheckBoxOutlineBlank, MdExpandMore } from "react-icons/md";

// Multi-value sibling of Listbox.jsx — same portal/positioning/outside-click
// machinery (copied rather than shared, so a change here can never regress
// the single-select used everywhere else), but `value` is an array and
// picking an option toggles it in/out instead of replacing the value and
// closing. Empty array means "All" — the same convention every filter using
// this already used for a single empty-string value.
//
// `options`: [{ value, label, dot? }]
export default function MultiSelect({
  value = [],
  onChange,
  options,
  placeholder = "All",
  allLabel,
  disabled = false,
  className = "",
  buttonClassName = "",
  panelClassName = "",
  align = "left",
  title,
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState(null);
  const rootRef = useRef(null);
  const selectedSet = new Set(value);

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPanelPos(
      align === "right"
        ? { top: r.bottom + 6, right: window.innerWidth - r.right, minWidth: r.width }
        : { top: r.bottom + 6, left: r.left, minWidth: r.width }
    );
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e) => {
      const inTrigger = rootRef.current?.contains(e.target);
      const inPanel = e.target?.closest?.('[data-listbox-panel="true"]');
      if (!inTrigger && !inPanel) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    const onScroll = (e) => {
      if (e.target?.closest?.('[data-listbox-panel="true"]')) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
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

  const triggerLabel = () => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) return options.find((o) => o.value === value[0])?.label || placeholder;
    if (allLabel && value.length === options.length) return allLabel;
    return `${value.length} selected`;
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((o) => !o);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full flex items-center justify-between gap-2 text-left transition-[border-color,box-shadow] duration-150 disabled:cursor-not-allowed ${
          buttonClassName ||
          "rounded-lg border border-gray-300 bg-white shadow-sm px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
        }`}
      >
        <span className={`truncate ${value.length ? "text-gray-800" : "text-gray-400"}`}>
          {triggerLabel()}
        </span>
        <MdExpandMore
          size={18}
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
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
            className={`z-50 w-max max-w-xs max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 ${panelClassName}`}
          >
            {value.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-primary-dark hover:bg-gray-50 border-b border-gray-100 mb-1"
              >
                Clear ({value.length})
              </button>
            )}
            {options.map((o) => {
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
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-gray-50 ${
                    checked ? "font-semibold text-gray-900" : "text-gray-700"
                  }`}
                >
                  {checked ? (
                    <MdCheckBox size={17} className="text-primary shrink-0" />
                  ) : (
                    <MdCheckBoxOutlineBlank size={17} className="text-gray-300 shrink-0" />
                  )}
                  {o.dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.dot}`} />}
                  <span className="truncate flex-1">{o.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
