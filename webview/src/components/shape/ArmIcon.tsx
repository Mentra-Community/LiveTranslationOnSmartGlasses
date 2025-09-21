interface SquareIconProps {
  className?: string;
}

export function ArmIcon({ className }: SquareIconProps) {
  return (
    <img
      src="../../../public/arm.svg" // relative to /public folder
      alt="Square icon"
      className={className}
    />
  );
}
