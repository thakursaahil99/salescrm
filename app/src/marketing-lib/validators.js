// "Contact Person" and "Contact No." sit right next to each other in the
// Add/Edit Lead forms — an easy beginner mix-up types the phone number into
// the wrong (name) field. Neither field validates its shape, so that typo
// saved silently and then resurfaced as a nonsense name on the FMS board.
// This is a soft check (not a hard block): strips spaces/dashes/parens/plus
// and flags it only if what's left is 7+ digits and nothing else — long
// enough that no real name collides with it.
export function looksLikePhoneNumber(text) {
  const stripped = String(text || "").replace(/[\s\-()+]/g, "");
  return /^\d{7,}$/.test(stripped);
}
