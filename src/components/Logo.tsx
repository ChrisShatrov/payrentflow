import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn(sizeClasses[size], className)}
    >
      <defs>
        <linearGradient id="houseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#14b8a6", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#0d9488", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#14b8a6", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#0ea5e9", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#0d9488", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#0891b2", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* House outline with rounded corners */}
      <path
        d="M 20 30 L 20 60 Q 20 65, 25 65 L 75 65 Q 80 65, 80 60 L 80 30 L 50 10 Z"
        fill="url(#houseGradient)"
        stroke="none"
      />
      
      {/* Chimney on right side of roof */}
      <rect x="70" y="25" width="8" height="12" rx="1" fill="url(#houseGradient)" />
      
      {/* Letter R inside house */}
      <text
        x="50"
        y="52"
        fontFamily="Arial, sans-serif"
        fontSize="28"
        fontWeight="bold"
        fill="#0d9488"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        R
      </text>
      
      {/* Upper wave layer */}
      <path
        d="M 15 70 Q 25 65, 35 68 T 50 70 T 65 68 T 85 70 L 85 80 Q 65 78, 50 80 T 15 80 Z"
        fill="url(#waveGradient1)"
      />
      
      {/* Lower wave layer (darker) */}
      <path
        d="M 10 75 Q 25 72, 40 75 T 50 77 T 60 75 T 90 77 L 90 100 L 10 100 Z"
        fill="url(#waveGradient2)"
      />
    </svg>
  );
}
