import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { LeasePreviewModal } from "./LeasePreviewModal";

interface CreateLeaseWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Unit {
  id: string;
  unit_number: string;
  tenant_id: string | null;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

interface Template {
  id: string;
  name: string;
  variables_schema_json: any[];
}

export function CreateLeaseWizard({ onComplete, onCancel }: CreateLeaseWizardProps) {
  const [step, setStep] = useState(1);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [leaseData, setLeaseData] = useState<Record<string, any>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProperties();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchUnits(selectedProperty);
    } else {
      setUnits([]);
      setSelectedUnit("");
    }
  }, [selectedProperty]);

  useEffect(() => {
    if (selectedUnit && selectedTemplate) {
      initializeLeaseData();
    }
  }, [selectedUnit, selectedTemplate]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("name");

      if (error) throw error;
      setProperties(data || []);
    } catch (error: any) {
      toast.error("Failed to load properties");
    }
  };

  const fetchUnits = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select(`
          *,
          profiles:tenant_id(
            full_name,
            email
          )
        `)
        .eq("property_id", propertyId)
        .order("unit_number");

      if (error) throw error;
      setUnits(data || []);
    } catch (error: any) {
      toast.error("Failed to load units");
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("lease_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast.error("Failed to load templates");
    }
  };

  const initializeLeaseData = async () => {
    if (!selectedUnit || !selectedTemplate) return;

    try {
      // Get unit and property details
      const { data: unitData } = await supabase
        .from("units")
        .select(`
          *,
          properties!inner(*),
          profiles:tenant_id(*)
        `)
        .eq("id", selectedUnit)
        .single();

      // Get landlord details
      const { data: { user } } = await supabase.auth.getUser();
      const { data: landlordData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      // Get template
      const template = templates.find((t) => t.id === selectedTemplate);
      if (!template) return;

      // Initialize lease data with defaults
      const initialData: Record<string, any> = {
        tenant_name: unitData?.profiles?.full_name || "",
        tenant_email: unitData?.profiles?.email || "",
        tenant_phone: unitData?.profiles?.phone || "",
        landlord_name: landlordData?.full_name || "",
        landlord_email: landlordData?.email || "",
        landlord_phone: landlordData?.phone || "",
        property_name: unitData?.properties?.name || "",
        property_address: unitData?.properties?.address || "",
        unit_number: unitData?.unit_number || "",
        rent_amount: unitData?.monthly_rent || "",
        deposit_amount: unitData?.monthly_rent || "", // Default to one month rent
        lease_start_date: new Date().toLocaleDateString(),
        lease_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        late_fee_amount: unitData?.late_fee_amount || "",
        late_fee_type: unitData?.late_fee_type || "flat",
        occupants: "",
        pet_deposit: "",
        parking_fee: "",
        utilities_included: "No",
      };

      setLeaseData(initialData);
    } catch (error: any) {
      console.error("Error initializing lease data:", error);
    }
  };

  const handleNext = () => {
    if (step === 1 && (!selectedProperty || !selectedUnit)) {
      toast.error("Please select a property and unit");
      return;
    }
    if (step === 2 && !selectedTemplate) {
      toast.error("Please select a template");
      return;
    }
    setStep(step + 1);
  };

  const handlePreview = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template first");
      return;
    }
    setPreviewOpen(true);
  };

  const handleCreate = async (sendForSignature: boolean) => {
    if (!selectedUnit || !selectedTemplate) {
      toast.error("Please complete all steps");
      return;
    }

    setCreating(true);
    try {
      const unit = units.find((u) => u.id === selectedUnit);
      if (!unit || !unit.tenant_id) {
        toast.error("Selected unit must have a tenant assigned");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-lease", {
        body: {
          unit_id: selectedUnit,
          tenant_id: unit.tenant_id,
          template_id: selectedTemplate,
          lease_data_json: leaseData,
          send_for_signature: sendForSignature,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(sendForSignature ? "Lease created and sent for signature" : "Lease created");
      onComplete();
    } catch (error: any) {
      toast.error(error.message || "Failed to create lease");
    } finally {
      setCreating(false);
    }
  };

  const selectedTemplateObj = templates.find((t) => t.id === selectedTemplate);
  const variables = selectedTemplateObj?.variables_schema_json || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Create Lease Agreement</h2>
        <div className="flex gap-2 mt-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Select Property/Unit */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Property</Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name} - {property.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Unit</Label>
            <Select
              value={selectedUnit}
              onValueChange={setSelectedUnit}
              disabled={!selectedProperty}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    Unit {unit.unit_number}
                    {unit.profiles
                      ? ` - ${unit.profiles.full_name}`
                      : " (No tenant assigned)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Step 2: Select Template */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Step 3: Fill Variables */}
      {step === 3 && (
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {variables.map((variable: any) => (
            <div key={variable.name} className="space-y-2">
              <Label>{variable.label || variable.name}</Label>
              <Input
                value={leaseData[variable.name] || ""}
                onChange={(e) =>
                  setLeaseData({ ...leaseData, [variable.name]: e.target.value })
                }
                placeholder={`Enter ${variable.label || variable.name}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Step 4: Preview & Send */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Review your lease agreement and send it for signature.
          </p>
          <Button onClick={handlePreview} variant="outline" className="w-full">
            Preview PDF
          </Button>
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={step > 1 ? () => setStep(step - 1) : onCancel}>
          {step > 1 ? (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </>
          ) : (
            "Cancel"
          )}
        </Button>
        {step < 4 ? (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleCreate(false)}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Save as Draft"
              )}
            </Button>
            <Button onClick={() => handleCreate(true)} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send for Signature"
              )}
            </Button>
          </div>
        )}
      </div>

      {selectedTemplate && (
        <LeasePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          templateId={selectedTemplate}
          leaseData={leaseData}
        />
      )}
    </div>
  );
}
