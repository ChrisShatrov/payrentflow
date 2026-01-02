import { Building2, MapPin } from "lucide-react";

interface PropertyCardProps {
  id: string;
  name: string;
  address: string;
  unitCount?: number;
  onClick?: () => void;
}

// Modern gradient backgrounds with geometric patterns
const gradientStyles = [
  "from-violet-500 via-purple-500 to-fuchsia-500",
  "from-cyan-500 via-teal-500 to-emerald-500",
  "from-orange-500 via-amber-500 to-yellow-500",
  "from-rose-500 via-pink-500 to-purple-500",
  "from-blue-500 via-indigo-500 to-violet-500",
  "from-emerald-500 via-green-500 to-teal-500",
];

export function PropertyCard({ id, name, address, unitCount = 0, onClick }: PropertyCardProps) {
  // Use a consistent gradient based on the property id
  const gradientIndex = id.charCodeAt(0) % gradientStyles.length;
  const gradient = gradientStyles[gradientIndex];

  return (
    <div
      onClick={onClick}
      className="group relative h-56 rounded-xl overflow-hidden cursor-pointer shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
      
      {/* Geometric Pattern Overlay */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`grid-${id}`} width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid-${id})`} />
        </svg>
      </div>

      {/* Abstract Shapes */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
      
      {/* Building Icon */}
      <div className="absolute top-4 right-4">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
          <Building2 className="h-5 w-5 text-white" />
        </div>
      </div>
      
      {/* Content */}
      <div className="absolute inset-0 p-5 flex flex-col justify-end">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:translate-x-1 transition-transform">
          {name}
        </h3>
        <div className="flex items-center gap-1.5 text-white/90 text-sm">
          <MapPin className="h-3.5 w-3.5" />
          <span className="truncate">{address}</span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {unitCount} {unitCount === 1 ? 'unit' : 'units'}
          </span>
        </div>
      </div>
    </div>
  );
}
