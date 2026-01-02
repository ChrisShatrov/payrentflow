import { Building2, MapPin } from "lucide-react";

interface PropertyCardProps {
  id: string;
  name: string;
  address: string;
  unitCount?: number;
  onClick?: () => void;
}

// Array of placeholder property images
const propertyImages = [
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&q=80",
];

export function PropertyCard({ id, name, address, unitCount = 0, onClick }: PropertyCardProps) {
  // Use a consistent image based on the property id
  const imageIndex = id.charCodeAt(0) % propertyImages.length;
  const backgroundImage = propertyImages[imageIndex];

  return (
    <div
      onClick={onClick}
      className="group relative h-56 rounded-xl overflow-hidden cursor-pointer shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      
      {/* Content */}
      <div className="absolute inset-0 p-5 flex flex-col justify-end">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-primary transition-colors">
          {name}
        </h3>
        <div className="flex items-center gap-1.5 text-white/80 text-sm">
          <MapPin className="h-3.5 w-3.5" />
          <span className="truncate">{address}</span>
        </div>
        <div className="flex items-center gap-1.5 text-white/70 text-sm mt-2">
          <Building2 className="h-3.5 w-3.5" />
          <span>{unitCount} {unitCount === 1 ? 'unit' : 'units'}</span>
        </div>
      </div>
    </div>
  );
}
