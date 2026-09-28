export default function Card({ className = "", children, padding = "p-5", onClick, ...rest }) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200/80 shadow-card transition-all duration-150 ${
        clickable ? "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5" : ""
      } ${padding} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
