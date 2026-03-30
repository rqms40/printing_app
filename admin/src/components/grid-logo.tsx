interface GridLogoProps {
  size?: number;
}

export function GridLogo({ size = 32 }: GridLogoProps) {
  const dot = size / 4.8;
  const gap = size / 6;
  const offset = (i: number) => dot / 2 + i * (dot + gap);

  const colors = [
    ["#F0F0F0", "#F0F0F0", "#FFDE58"],
    ["#F0F0F0", "#F0F0F0", "#F0F0F0"],
    ["#F0F0F0", "#F0F0F0", "#5B5B5B"],
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {colors.map((row, r) =>
        row.map((fill, c) => (
          <circle
            key={`${r}-${c}`}
            cx={offset(c)}
            cy={offset(r)}
            r={dot / 2}
            fill={fill}
          />
        )),
      )}
    </svg>
  );
}
