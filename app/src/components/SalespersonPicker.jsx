import MultiSelect from "./ui/MultiSelect.jsx";

// Slices a report/board down to one or several salespeople. `value` is an
// array of ids ([] for everyone); `people` is [{ _id, name }, ...].
export default function SalespersonPicker({ value, onChange, people }) {
  return (
    <MultiSelect
      value={value}
      onChange={onChange}
      className="w-44"
      placeholder="All salespeople"
      allLabel="All salespeople"
      options={people.map((p) => ({ value: p._id, label: p.name }))}
    />
  );
}
