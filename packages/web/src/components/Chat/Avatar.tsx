interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}

const COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1',
  '#1E88E5', '#039BE5', '#00ACC1', '#00897B',
  '#43A047', '#7CB342', '#F4511E', '#FB8C00',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const color = getColor(name);
  const initials = getInitials(name);
  const fontSize = Math.max(size * 0.38, 12);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`avatar ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={`avatar flex items-center justify-center text-white font-semibold select-none flex-shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: color, fontSize }}
    >
      {initials}
    </div>
  );
}
