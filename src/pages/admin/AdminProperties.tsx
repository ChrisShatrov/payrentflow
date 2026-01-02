import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { PropertyCard } from "@/components/admin/PropertyCard";
import { AddPropertyDialog } from "@/components/admin/AddPropertyDialog";
import { PropertyDetailSheet } from "@/components/admin/PropertyDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";

interface Property {
  id: string;
  name: string;
  address: string;
  created_at: string;
  unitCount?: number;
}

export default function AdminProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchProperties = async () => {
    try {
      // Fetch properties with unit counts
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name, address, created_at")
        .order("created_at", { ascending: false });

      if (propertiesError) throw propertiesError;

      // Fetch unit counts for each property
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("property_id");

      if (unitsError) throw unitsError;

      // Count units per property
      const unitCounts = (unitsData || []).reduce((acc: Record<string, number>, unit) => {
        acc[unit.property_id] = (acc[unit.property_id] || 0) + 1;
        return acc;
      }, {});

      const propertiesWithCounts = (propertiesData || []).map((p) => ({
        ...p,
        unitCount: unitCounts[p.id] || 0,
      }));

      setProperties(propertiesWithCounts);
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handlePropertyClick = (property: Property) => {
    setSelectedProperty(property);
    setSheetOpen(true);
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Properties</h1>
            <p className="text-muted-foreground mt-1">Manage your rental properties</p>
          </div>
          <AddPropertyDialog onPropertyAdded={fetchProperties} />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : properties.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No properties yet</h3>
            <p className="text-muted-foreground mb-6">
              Get started by adding your first property.
            </p>
            <AddPropertyDialog onPropertyAdded={fetchProperties} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                id={property.id}
                name={property.name}
                address={property.address}
                unitCount={property.unitCount}
                onClick={() => handlePropertyClick(property)}
              />
            ))}
          </div>
        )}

        {/* Property Detail Sheet */}
        <PropertyDetailSheet
          property={selectedProperty}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      </div>
    </AdminLayout>
  );
}
