interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, alt = '', size = 32, className = '' }: AvatarProps) {
  const sizeStyle = { width: size, height: size, minWidth: size };

  if (!src || src.includes('default_avatar')) {
    return (
      <div
        className={`rounded-full bg-bg-glass-active flex items-center justify-center text-text-tertiary ${className}`}
        style={sizeStyle}
      >
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="5.5" r="3" />
          <path d="M2 14.5c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src.replace('-large', '-t200x200')}
      alt={alt}
      className={`rounded-full object-cover ${className}`}
      style={sizeStyle}
    />
  );
}
