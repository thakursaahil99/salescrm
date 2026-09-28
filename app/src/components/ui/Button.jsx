const VARIANTS = {
  primary: "bg-primary text-white shadow-sm shadow-primary/25 hover:bg-primary-dark hover:shadow-md hover:shadow-primary/25",
  secondary: "bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400",
  // Transparent + bordered — a lower-emphasis alternative to `secondary` for
  // less-important actions that still need a visible hit area (e.g. next to
  // a primary action in a form footer).
  outline: "bg-transparent text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400",
  // Solid red-600, deliberately distinct from the brand-red `primary` so a
  // destructive action never reads as "just another primary button".
  danger: "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 hover:shadow-md hover:shadow-red-600/20",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
};
const SIZES = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
};

export default function Button({
  as: Comp = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <Comp
      className={`inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </Comp>
  );
}
