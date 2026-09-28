import { useToast as useSharedToast } from "../context/ToastContext.jsx";

// Presents the app's one shared toast system in the shape Marketing CRM's
// ported pages already expect — `toast.push(message, type)` — instead of
// running a second, separate toast UI just for this section.
export function useToast() {
  const toast = useSharedToast();
  return { push: (message, type = "info") => (toast[type] || toast.info)(message) };
}
