import { MdInbox } from "react-icons/md";

export default function EmptyState({ icon: Icon = MdInbox, title = "Nothing here yet", message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" aria-hidden="true" />
        <div className="relative h-14 w-14 rounded-2xl bg-primary-light text-primary flex items-center justify-center ring-1 ring-primary/10">
          <Icon size={26} />
        </div>
      </div>
      <p className="font-semibold text-gray-900">{title}</p>
      {message && <p className="text-sm text-gray-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
