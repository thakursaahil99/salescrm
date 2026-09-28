// Simple pill tab bar. `tabs` = [{ key, label, count? }].
export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1.5 border-b border-gray-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3.5 py-2 text-sm border-b-2 -mb-px transition-colors ${
            active === t.key
              ? "border-primary text-primary-dark font-semibold"
              : "border-transparent font-medium text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.label}
          {t.count != null && (
            <span
              className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                active === t.key ? "bg-primary-light text-primary-dark" : "bg-gray-100 text-gray-500"
              }`}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
