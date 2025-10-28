interface SquareIconProps {
  className?: string;
}

export function SquareIcon({ className }: SquareIconProps) {
  return (
    <img
      src="/square.svg" // files in public should be referenced from root
      alt="Square icon"
      className={className}
    />
  );
}
