export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M16 2 29 25H3L16 2Z" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="m10 25 6-10 6 10M9 16h14"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}
