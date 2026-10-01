import Spinner from "./ui/Spinner.jsx";
import EmptyState from "./ui/EmptyState.jsx";

// Generic table. `columns` is [{ key, header, render?, className?, align?,
// hideOnMobile? }]. `render(row)` overrides the default `row[key]`.
// `onRowClick` makes rows clickable. `hideOnMobile` drops a lower-priority
// column below the `sm` breakpoint instead of adding to the horizontal
// scroll. `skeletonRows` (opt-in) shows placeholder rows under the real
// header while loading instead of a spinner, so the layout doesn't jump.
// Keeps markup minimal — pagination is a separate component below it.
export default function DataTable({
  columns,
  rows,
  loading,
  keyField = "_id",
  onRowClick,
  empty,
  skeletonRows = 0,
}) {
  if (loading && !skeletonRows) return <Spinner />;
  if (!loading && !rows?.length) return empty || <EmptyState />;

  // The first column is what identifies the row (name, member, outlet…) — on
  // a phone, scrolling right to see the rest of a wide table would otherwise
  // scroll it out of view too, so there's no way to tell which row you're
  // even looking at. Pinning it keeps that context on screen the whole time.
  const stickyFirst = "sticky left-0 z-[1]";
  const cellBase = (c, i) =>
    `px-3.5 align-middle border-b border-gray-100 [tr:last-child>&]:border-b-0 ${
      i === 0 ? stickyFirst : ""
    } ${c.align === "right" ? "text-right" : ""} ${c.hideOnMobile ? "hidden sm:table-cell" : ""}`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-[#64748b] bg-gray-50/80">
            {columns.map((c, i) => (
              <th
                key={c.key}
                className={`py-3 px-3.5 border-b border-gray-200 first:rounded-tl-xl last:rounded-tr-xl bg-gray-50/95 whitespace-nowrap ${
                  i === 0 ? stickyFirst + " z-[2]" : ""
                } ${c.align === "right" ? "text-right" : ""} ${
                  c.hideOnMobile ? "hidden sm:table-cell" : ""
                } ${c.headerClassName || ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, r) => (
                <tr key={`sk-${r}`}>
                  {columns.map((c, i) => (
                    <td key={c.key} className={`py-4 bg-white ${cellBase(c, i)}`}>
                      <span
                        className={`block h-3.5 rounded-md bg-gray-100 animate-pulse ${
                          i === 0 ? "w-40" : c.align === "right" ? "w-12 ml-auto" : "w-20"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={row[keyField]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`group ${onRowClick ? "cursor-pointer" : ""} transition-colors`}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={`py-3.5 text-gray-700 bg-white ${
                        onRowClick ? "group-hover:bg-[#FFF6F7]" : ""
                      } transition-colors ${cellBase(c, i)} ${c.className || ""}`}
                    >
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
