import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import api from "../../lib/api.js";
import { getSocket } from "../../lib/socket.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { push } = useToast();

  const load = async () => {
    try {
      const res = await api.get("/notifications/due");
      setItems(res.data.data);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);

    const socket = getSocket();
    const onDue = (payload) => {
      push(`Reminder: ${payload.siteName}${payload.note ? " — " + payload.note : ""}`, "info");
      load();
    };
    socket.on("reminder:due", onDue);

    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);

    return () => {
      clearInterval(interval);
      socket.off("reminder:due", onDue);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  const dismiss = async (id) => {
    await api.patch(`/notifications/${id}/notified`);
    setItems((prev) => prev.filter((i) => i._id !== id));
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-icon relative">
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 card p-2 z-50 max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No reminders due.</p>
          ) : (
            items.map((i) => (
              <div key={i._id} className="p-2.5 rounded-lg hover:bg-gray-50 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{i.lead?.siteName || i.siteName}</p>
                  {i.note && <p className="text-xs text-gray-500 mt-0.5">{i.note}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{new Date(i.dateTime).toLocaleString("en-IN")}</p>
                </div>
                <button onClick={() => dismiss(i._id)} className="text-xs text-brand font-semibold shrink-0">
                  Dismiss
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
