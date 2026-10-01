import { MdChevronLeft, MdChevronRight } from "react-icons/md";

// First, last, and the current page ±1, with "…" gaps — e.g. 1 … 4 5 6 … 12.
function pageList(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push("gap-" + n);
    out.push(n);
  });
  return out;
}

// Pager with a "Showing x–y of z" summary. Hidden entirely when there's only
// one page. `limit` is the page size the list was fetched with.
export default function Pagination({ page, pages, total, onChange, limit = 20, noun = "results" }) {
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = total != null ? Math.min(page * limit, total) : page * limit;
  const btn =
    "h-8 min-w-[32px] px-2 inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3 text-sm">
      <span className="text-gray-500">
        Showing <b className="text-gray-900">{from}–{to}</b>
        {total != null && (
          <>
            {" "}of <b className="text-gray-900">{total}</b> {noun}
          </>
        )}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={`${btn} border border-gray-200 bg-white hover:bg-gray-50`}
        >
          <MdChevronLeft size={18} />
        </button>
        {pageList(page, pages).map((n) =>
          typeof n === "string" ? (
            <span key={n} className="px-1 text-gray-400">…</span>
          ) : (
            <button
              key={n}
              onClick={() => n !== page && onChange(n)}
              aria-current={n === page ? "page" : undefined}
              className={`${btn} ${
                n === page
                  ? "bg-primary text-white shadow-sm shadow-primary/25"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
          className={`${btn} border border-gray-200 bg-white hover:bg-gray-50`}
        >
          <MdChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
