export function BrandMark({ size = 46 }: { size?: number }) {
  return (
    <img
      src="/brand/vabix-mark.png"
      alt="VABIX"
      width={size}
      height={size}
      className="mark"
    />
  );
}
