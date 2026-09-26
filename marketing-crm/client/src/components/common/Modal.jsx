import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-backdrop-in" onMouseDown={onClose}>
      <div
        className={`animate-modal-in bg-white rounded-xl shadow-modal w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-bold text-gray-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
