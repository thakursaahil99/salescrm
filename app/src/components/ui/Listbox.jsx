import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdCheck, MdExpandMore } from "react-icons/md";

// A fully custom single-select dropdown — the browser's native <select>
// popup can't be styled (no rounded corners, no hover states, OS-themed
// highlight), so anywhere that mattered visually gets this instead. Same
// value/onChange contract as a native select, so it's a drop-in swap for a
// plain, non-form-registered dropdown (filters, pickers, inline pills).
//
// The open option panel is rendered through a portal into <body>, positioned
// with fixed coordinates computed from the trigger button — not CSS
// `position: absolute` inside the trigger's own DOM parent. A plain absolute
// panel gets silently clipped (or forced onto its own tiny scrollbar) by any
// scrollable ancestor, e.g. a wide table's `overflow-x-auto` wrapper, since
// that same rule clips vertical overflow too. Escaping to the body sidesteps
// that entirely, same as every other portal-based dropdown.
//
// `options`: [{ value, label, dot? (a Tailwind bg-* class for a status dot) }]
// `renderTrigger(selected)`: replaces the default label+chevron button with a
// fully custom look (used by LeadStageSelect for its coloured pill).
export default function Listbox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className = "",
  buttonClassName = "",
  panelClassName = "",
  renderTrigger,
  align = "left",
  title,
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [panelPos, setPanelPos] = useState(null); // { top, left/right, width }
  const rootRef = useRef(null);
  const selected = options.find((o) => o.value === value);

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
      // The open panel is portaled to <body> (see the render below), so it's
      // never a DOM descendant of rootRef — checking only rootRef.contains()
      // made every click INSIDE the panel register as "outside" and close it
      // on mousedown, before the option's own click could ever fire. A real
      // sale (Record conversion → Conversion type) or a Zoom-meeting pick
      // silently did nothing because of exactly this.
      const inTrigger = rootRef.current?.contains(e.target);
      const inPanel = e.target?.closest?.('[data-listbox-panel="true"]');
      if (!inTrigger && !inPanel) setOpen(false);
    };
    // Capture phase: another Listbox's own trigger calls stopPropagation() on
    // its mousedown (so it doesn't also fire a table row's onClick) — a
    // bubble-phase listener here would never see that event. Capture fires
    // on the way down, before any target's stopPropagation can block it, so
    // opening a second dropdown still reliably closes this one.
    document.addEventListener("mousedown", onDoc, true);
    // The panel's screen position is computed once, on open — reposition
    // (rather than track continuously) on scroll/resize, and just close on a
    // scroll that isn't the panel's own (its own list can still scroll to
    // reach lower options without the whole thing vanishing).
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

  useEffect(() => {
    if (open) setActiveIdx(Math.max(0, options.findIndex((o) => o.value === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (opt) => {
    setOpen(false);
    if (opt.value !== value) onChange(opt.value);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[activeIdx]) pick(options[activeIdx]);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((o) => !o);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={
          renderTrigger
            ? buttonClassName
            : // `buttonClassName`, when given, REPLACES (not merges with) the default
              // look below — Tailwind utilities don't reliably override each other by
              // string order, so mixing "rounded-lg ... rounded-md" would be a coin flip.
              `w-full flex items-center justify-between gap-2 text-left transition-[border-color,box-shadow] duration-150 disabled:cursor-not-allowed ${
                buttonClassName ||
                "rounded-lg border border-gray-300 bg-white shadow-sm px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              }`
        }
      >
        {renderTrigger ? (
          renderTrigger(selected)
        ) : (
          <>
            <span className={`truncate ${selected ? "text-gray-800" : "text-gray-400"}`}>
              {selected ? selected.label : placeholder}
            </span>
            <MdExpandMore
              size={18}
              className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            data-listbox-panel="true"
            role="listbox"
            style={{ position: "fixed", ...panelPos }}
            className={`z-50 w-max max-w-xs max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 ${panelClassName}`}
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={(e) => {
                  e.stopPropagation();
                  pick(o);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  i === activeIdx ? "bg-primary-light/50" : ""
                } ${o.value === value ? "font-semibold text-gray-900" : "text-gray-700"}`}
              >
                {o.dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.dot}`} />}
                <span className="truncate flex-1">{o.label}</span>
                {o.value === value && <MdCheck size={16} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
