import { useRef, useState } from "react";
import { createPortal } from "react-dom";

// A small hover tooltip rendered through a portal into <body> with fixed
// coordinates — so it's never clipped by a scrollable/overflow-hidden ancestor
// (e.g. the leads table's Card). Shows instantly on hover, unlike the native
// `title` attribute's ~1s delay. `content` is any node; nothing renders when
// it's empty.
export default function Tooltip({ content, children, className = "" }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Below the trigger, left-aligned, clamped so a wide tip can't run off-screen.
    const left = Math.min(r.left, window.innerWidth - 340);
    setPos({ top: r.bottom + 6, left: Math.max(8, left) });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      onMouseEnter={content ? show : undefined}
      onMouseLeave={hide}
      className={className}
    >
      {children}
      {content &&
        pos &&
        createPortal(
          <div
            style={{ position: "fixed", top: pos.top, left: pos.left, maxWidth: 320 }}
            className="z-[60] rounded-lg bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-modal ring-1 ring-black/10 animate-fade-in pointer-events-none"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}
