// Keeps a text input numeric-only as the user types, instead of only
// catching a bad value on submit — a stray letter or an 11th digit never
// appears in the box at all. The backend still re-validates independently;
// this is purely the typing experience. Wire into react-hook-form via the
// register options' `onChange`, e.g.:
//   {...register("phone", { onChange: (e) => digitsOnly(e, 10) })}
// React reads `e.target.value` right after this mutates it, same event.
export function digitsOnly(e, maxLen) {
  const next = e.target.value.replace(/\D/g, "");
  e.target.value = maxLen ? next.slice(0, maxLen) : next;
}

// A 10-digit Indian mobile number specifically — every phone field in this
// app is this shape.
export const phoneOnChange = (e) => digitsOnly(e, 10);
