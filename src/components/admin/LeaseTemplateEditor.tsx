import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, X, FileText, Undo2, Redo2 } from "lucide-react";
import { LeasePreviewModal } from "./LeasePreviewModal";

interface LeaseTemplate {
  id: string;
  name: string;
  body_html: string;
  variables_schema_json: any;
}

interface LeaseTemplateEditorProps {
  template: LeaseTemplate | null;
  onSave: () => void;
  onCancel: () => void;
}

const AVAILABLE_VARIABLES = [
  { value: "tenant_name", label: "Tenant Name" },
  { value: "tenant_email", label: "Tenant Email" },
  { value: "tenant_phone", label: "Tenant Phone" },
  { value: "landlord_name", label: "Landlord Name" },
  { value: "landlord_email", label: "Landlord Email" },
  { value: "landlord_phone", label: "Landlord Phone" },
  { value: "property_name", label: "Property Name" },
  { value: "property_address", label: "Property Address" },
  { value: "unit_number", label: "Unit Number" },
  { value: "rent_amount", label: "Monthly Rent Amount" },
  { value: "deposit_amount", label: "Security Deposit" },
  { value: "lease_start_date", label: "Lease Start Date" },
  { value: "lease_end_date", label: "Lease End Date" },
  { value: "late_fee_amount", label: "Late Fee Amount" },
  { value: "late_fee_type", label: "Late Fee Type" },
  { value: "occupants", label: "Occupants" },
  { value: "pet_deposit", label: "Pet Deposit" },
  { value: "parking_fee", label: "Parking Fee" },
  { value: "utilities_included", label: "Utilities Included" },
];

export function LeaseTemplateEditor({
  template,
  onSave,
  onCancel,
}: LeaseTemplateEditorProps) {
  const [name, setName] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [selectedVariable, setSelectedVariable] = useState("");
  const [saving, setSaving] = useState(false);
  const [testPreviewOpen, setTestPreviewOpen] = useState(false);
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null);
  
  // Undo/Redo state
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      const initialHtml = template.body_html;
      setBodyHtml(initialHtml);
      setHistory([initialHtml]);
      setHistoryIndex(0);
    } else {
      setName("");
      const defaultHtml = `<h1>Lease Agreement</h1>
<p>This lease agreement is entered into on {{lease_start_date}} between {{landlord_name}} (Landlord) and {{tenant_name}} (Tenant).</p>

<h2>Property Details</h2>
<p><strong>Property:</strong> {{property_name}}</p>
<p><strong>Address:</strong> {{property_address}}</p>
<p><strong>Unit:</strong> {{unit_number}}</p>

<h2>Terms and Conditions</h2>
<p><strong>Monthly Rent:</strong> {{rent_amount}}</p>
<p><strong>Security Deposit:</strong> {{deposit_amount}}</p>
<p><strong>Lease Term:</strong> {{lease_start_date}} to {{lease_end_date}}</p>
<p><strong>Late Fee:</strong> {{late_fee_amount}} ({{late_fee_type}})</p>

<h2>Signatures</h2>
<p>Landlord: {{landlord_name}}</p>
<p>Tenant: {{tenant_name}}</p>
<p>Date: _______________</p>`;
      setBodyHtml(defaultHtml);
      setHistory([defaultHtml]);
      setHistoryIndex(0);
    }
  }, [template]);

  // Track changes for undo/redo
  useEffect(() => {
    // Skip if this change is from undo/redo
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    
    // Only add to history if it's a user change and different from current history state
    const currentHistoryState = history[historyIndex];
    if (history.length > 0 && currentHistoryState !== bodyHtml) {
      // Remove any future history if we're not at the end
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(bodyHtml);
      
      // Limit history to 50 entries to prevent memory issues
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHtml]);

  const insertVariable = () => {
    if (!selectedVariable) return;
    const variable = `{{${selectedVariable}}}`;
    setBodyHtml((prev) => prev + variable);
    setSelectedVariable("");
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setBodyHtml(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setBodyHtml(history[newIndex]);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const extractVariables = (html: string): string[] => {
    const matches = html.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    const variables = matches.map((match) => match.replace(/\{\{|\}\}/g, ""));
    return [...new Set(variables)];
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (!bodyHtml.trim()) {
      toast.error("Please enter template content");
      return;
    }

    setSaving(true);
    try {
      const variables = extractVariables(bodyHtml);
      const variablesSchema = variables.map((v) => {
        const variableInfo = AVAILABLE_VARIABLES.find((av) => av.value === v);
        return {
          name: v,
          label: variableInfo?.label || v,
          type: "string",
        };
      });

      if (template) {
        // Update existing template
        const { error } = await supabase
          .from("lease_templates")
          .update({
            name: name.trim(),
            body_html: bodyHtml,
            variables_schema_json: variablesSchema,
            updated_at: new Date().toISOString(),
          })
          .eq("id", template.id);

        if (error) throw error;
        toast.success("Template updated");
      } else {
        // Create new template
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("You must be logged in to create a template");
        }

        const { error } = await supabase.from("lease_templates").insert({
          landlord_id: user.id,
          name: name.trim(),
          body_html: bodyHtml,
          variables_schema_json: variablesSchema,
        });

        if (error) throw error;
        toast.success("Template created");
      }

      onSave();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const generateSampleData = (): Record<string, any> => {
    const variables = extractVariables(bodyHtml);
    const sampleData: Record<string, any> = {};
    
    variables.forEach((varName) => {
      switch (varName) {
        case "tenant_name":
          sampleData[varName] = "John Doe";
          break;
        case "tenant_email":
          sampleData[varName] = "john.doe@example.com";
          break;
        case "tenant_phone":
          sampleData[varName] = "(555) 123-4567";
          break;
        case "landlord_name":
          sampleData[varName] = "Jane Smith";
          break;
        case "landlord_email":
          sampleData[varName] = "jane.smith@example.com";
          break;
        case "landlord_phone":
          sampleData[varName] = "(555) 987-6543";
          break;
        case "property_name":
          sampleData[varName] = "Sunset Apartments";
          break;
        case "property_address":
          sampleData[varName] = "123 Main Street, City, State 12345";
          break;
        case "unit_number":
          sampleData[varName] = "101";
          break;
        case "rent_amount":
          sampleData[varName] = "$1,500.00";
          break;
        case "deposit_amount":
          sampleData[varName] = "$1,500.00";
          break;
        case "lease_start_date":
          sampleData[varName] = new Date().toLocaleDateString();
          break;
        case "lease_end_date":
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1);
          sampleData[varName] = endDate.toLocaleDateString();
          break;
        case "late_fee_amount":
          sampleData[varName] = "$50.00";
          break;
        case "late_fee_type":
          sampleData[varName] = "flat";
          break;
        case "occupants":
          sampleData[varName] = "2";
          break;
        case "pet_deposit":
          sampleData[varName] = "$300.00";
          break;
        case "parking_fee":
          sampleData[varName] = "$50.00";
          break;
        case "utilities_included":
          sampleData[varName] = "Water and Trash";
          break;
        default:
          sampleData[varName] = `[${varName}]`;
      }
    });
    
    return sampleData;
  };

  const handleTestTemplate = async () => {
    if (!bodyHtml.trim()) {
      toast.error("Please enter template content first");
      return;
    }

    // If template exists, use its ID, otherwise we need to save it first
    if (template?.id) {
      setTestTemplateId(template.id);
      setTestPreviewOpen(true);
    } else {
      // For new templates, save it first (as draft) then test
      if (!name.trim()) {
        toast.error("Please enter a template name first");
        return;
      }

      setSaving(true);
      try {
        const variables = extractVariables(bodyHtml);
        const variablesSchema = variables.map((v) => {
          const variableInfo = AVAILABLE_VARIABLES.find((av) => av.value === v);
          return {
            name: v,
            label: variableInfo?.label || v,
            type: "string",
          };
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("You must be logged in to test a template");
        }

        const { data, error } = await supabase
          .from("lease_templates")
          .insert({
            landlord_id: user.id,
            name: name.trim() || "Test Template",
            body_html: bodyHtml,
            variables_schema_json: variablesSchema,
          })
          .select()
          .single();

        if (error) throw error;
        
        setTestTemplateId(data.id);
        setTestPreviewOpen(true);
        toast.success("Template saved. Opening preview...");
        onSave(); // Refresh the list
      } catch (error: any) {
        console.error("Error saving template for test:", error);
        toast.error(error.message || "Failed to save template for testing");
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">
          {template ? "Edit Template" : "Create Template"}
        </h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-name">Template Name</Label>
        <Input
          id="template-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Standard Residential Lease"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="template-body">Template Content (HTML)</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Select value={selectedVariable} onValueChange={setSelectedVariable}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Insert variable" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_VARIABLES.map((variable) => (
                  <SelectItem key={variable.value} value={variable.value}>
                    {variable.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={insertVariable}
              disabled={!selectedVariable}
            >
              Insert
            </Button>
          </div>
        </div>
        <Textarea
          id="template-body"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          placeholder="Enter your lease template HTML here. Use {{variable_name}} for placeholders."
          className="min-h-[400px] font-mono text-sm"
        />
        <p className="text-sm text-muted-foreground">
          Use double curly braces to insert variables, e.g., {"{{tenant_name}}"}
        </p>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleTestTemplate}
          disabled={saving || !bodyHtml.trim()}
          className="text-primary border-primary hover:bg-primary/10"
        >
          <FileText className="h-4 w-4 mr-2" />
          Test Template (Preview PDF)
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : template ? "Update Template" : "Create Template"}
          </Button>
        </div>
      </div>

      {testTemplateId && (
        <LeasePreviewModal
          open={testPreviewOpen}
          onOpenChange={setTestPreviewOpen}
          templateId={testTemplateId}
          leaseData={generateSampleData()}
        />
      )}
    </div>
  );
}
