import { Outlet } from "react-router-dom";

// First screen of the whole product — kept quiet and premium rather than
// consumer-flashy: the brand red only shows up as a faint radial wash behind
// the card, never as a loud gradient.
export default function AuthLayout() {
  return (
    <div className="relative min-h-dvh flex items-center justify-center bg-surface px-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(193,18,31,0.07), transparent 70%)",
        }}
      />
      <div className="relative w-full flex items-center justify-center">
        <Outlet />
      </div>
    </div>
  );
}
