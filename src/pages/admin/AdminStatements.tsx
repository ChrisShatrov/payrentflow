import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  FileDown, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Loader2, 
  Search,
  Calendar,
  Building2,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

interface StatementData {
  id: string;
  period_month: string;
  base_rent: number;
  late_fee: number | null;
  additional_fees: number | null;
  split_fee: number | null;
  total_due: number;
  status: string;
  pdf_url: string | null;
  created_at: string | null;
  unit_number: string;
  property_name: string;
  tenant_name: string | null;
}

interface YearlySummary {
  year: string;
  propertyId: string;
  propertyName: string;
  totalStatements: number;
  totalBaseRent: number;
  totalLateFees: number;
  totalAdditionalFees: number;
  totalSplitFees: number;
  totalDue: number;
  totalPaid: number;
  totalUnpaid: number;
}

const ITEMS_PER_PAGE = 10;

export default function AdminStatements() {
  const { user } = useAuth();
  const [statements, setStatements] = useState<StatementData[]>([]);
  const [allStatements, setAllStatements] = useState<StatementData[]>([]);
  const [yearlySummaries, setYearlySummaries] = useState<YearlySummary[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBy, setSearchBy] = useState<"all" | "property" | "tenant" | "unit">("all");
  const [selectedProperty, setSelectedProperty] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchAllStatements();
    }
  }, [user]);

  useEffect(() => {
    if (user && allStatements.length > 0) {
      filterAndPaginateStatements();
      calculateYearlySummaries();
    }
  }, [user, currentPage, searchQuery, searchBy, selectedProperty, allStatements]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const fetchAllStatements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("statements")
        .select(`
          *,
          units!inner(
            unit_number,
            tenant_id,
            property_id,
            properties!inner(id, name, landlord_id),
            profiles(full_name)
          )
        `)
        .eq("units.properties.landlord_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedStatements: StatementData[] = (data || []).map((s: any) => ({
        id: s.id,
        period_month: s.period_month,
        base_rent: s.base_rent,
        late_fee: s.late_fee,
        additional_fees: s.additional_fees,
        split_fee: s.split_fee,
        total_due: s.total_due,
        status: s.status,
        pdf_url: s.pdf_url,
        created_at: s.created_at,
        unit_number: s.units?.unit_number || "N/A",
        property_name: s.units?.properties?.name || "N/A",
        tenant_name: s.units?.profiles?.full_name || null,
      }));

      setAllStatements(formattedStatements);
    } catch (error) {
      console.error("Error fetching statements:", error);
      toast.error("Failed to load statements");
    } finally {
      setLoading(false);
    }
  };

  const filterAndPaginateStatements = () => {
    let filtered = [...allStatements];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((statement) => {
        if (searchBy === "property" || searchBy === "all") {
          if (statement.property_name.toLowerCase().includes(query)) return true;
        }
        if (searchBy === "tenant" || searchBy === "all") {
          if (statement.tenant_name?.toLowerCase().includes(query)) return true;
        }
        if (searchBy === "unit" || searchBy === "all") {
          if (statement.unit_number.toLowerCase().includes(query)) return true;
        }
        return false;
      });
    }

    // Apply property filter
    if (selectedProperty !== "all") {
      const property = properties.find(p => p.id === selectedProperty);
      if (property) {
        filtered = filtered.filter(s => s.property_name === property.name);
      }
    }

    // Update total count
    setTotalCount(filtered.length);

    // Apply pagination
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE;
    const paginated = filtered.slice(from, to);

    setStatements(paginated);
    
    // Reset to page 1 if current page is out of bounds
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  };

  const calculateYearlySummaries = () => {
    const summaries: Record<string, YearlySummary> = {};

    allStatements.forEach((statement) => {
      const [month, year] = statement.period_month.split("/");
      const key = `${year}-${statement.property_name}`;

      if (!summaries[key]) {
        summaries[key] = {
          year,
          propertyId: properties.find(p => p.name === statement.property_name)?.id || "",
          propertyName: statement.property_name,
          totalStatements: 0,
          totalBaseRent: 0,
          totalLateFees: 0,
          totalAdditionalFees: 0,
          totalSplitFees: 0,
          totalDue: 0,
          totalPaid: 0,
          totalUnpaid: 0,
        };
      }

      const summary = summaries[key];
      summary.totalStatements += 1;
      summary.totalBaseRent += statement.base_rent;
      summary.totalLateFees += statement.late_fee || 0;
      summary.totalAdditionalFees += statement.additional_fees || 0;
      summary.totalSplitFees += statement.split_fee || 0;
      summary.totalDue += statement.total_due;

      if (statement.status === "paid") {
        summary.totalPaid += statement.total_due;
      } else {
        summary.totalUnpaid += statement.total_due;
      }
    });

    // Validate calculations and fix any discrepancies
    Object.values(summaries).forEach((summary) => {
      // Calculate expected total due from components
      const expectedTotalDue = summary.totalBaseRent + summary.totalLateFees + summary.totalAdditionalFees + summary.totalSplitFees;
      
      // Validate: totalDue should equal baseRent + fees
      const tolerance = 0.01; // Allow for floating point rounding
      if (Math.abs(summary.totalDue - expectedTotalDue) > tolerance) {
        console.warn(
          `[AdminStatements] Calculation discrepancy for ${summary.propertyName} (${summary.year}):`,
          {
            calculatedTotalDue: summary.totalDue,
            expectedTotalDue,
            difference: summary.totalDue - expectedTotalDue,
            baseRent: summary.totalBaseRent,
            lateFees: summary.totalLateFees,
            additionalFees: summary.totalAdditionalFees,
          }
        );
        // Use the expected value to ensure consistency
        summary.totalDue = expectedTotalDue;
      }

      // Validate: totalDue should equal paid + unpaid
      const expectedFromStatus = summary.totalPaid + summary.totalUnpaid;
      if (Math.abs(summary.totalDue - expectedFromStatus) > tolerance) {
        console.warn(
          `[AdminStatements] Status discrepancy for ${summary.propertyName} (${summary.year}):`,
          {
            calculatedTotalDue: summary.totalDue,
            expectedFromStatus,
            difference: summary.totalDue - expectedFromStatus,
            totalPaid: summary.totalPaid,
            totalUnpaid: summary.totalUnpaid,
          }
        );
        // Adjust unpaid to match (paid is more reliable)
        summary.totalUnpaid = summary.totalDue - summary.totalPaid;
      }
    });

    // Convert to array and sort by year (descending) then property name
    const summariesArray = Object.values(summaries).sort((a, b) => {
      if (a.year !== b.year) {
        return b.year.localeCompare(a.year);
      }
      return a.propertyName.localeCompare(b.propertyName);
    });

    setYearlySummaries(summariesArray);
  };

  const generatePdf = async (statementId: string) => {
    setGeneratingPdf(statementId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-statement-pdf", {
        body: { statement_id: statementId },
      });

      if (error) throw error;

      if (data?.pdf_url) {
        // Update local state with new PDF URL
        setAllStatements((prev) =>
          prev.map((s) =>
            s.id === statementId ? { ...s, pdf_url: data.pdf_url } : s
          )
        );
        toast.success("PDF generated successfully");
        
        // Open the PDF in a new tab
        window.open(data.pdf_url, "_blank");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const formatPeriodMonth = (period: string) => {
    const [month, year] = period.split("/");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "partial":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Partial</Badge>;
      default:
        return <Badge variant="secondary">Unpaid</Badge>;
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <AdminLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Statements</h1>
          <p className="text-muted-foreground mt-1">
            View and manage rent statements for all units
          </p>
        </div>

        {/* Section 1: Tenant Statements */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Tenant Statements</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{totalCount} total statements</span>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <Card className="p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search statements..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="searchBy">Search By</Label>
                <Select
                  value={searchBy}
                  onValueChange={(value: any) => {
                    setSearchBy(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger id="searchBy" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fields</SelectItem>
                    <SelectItem value="property">Property Name</SelectItem>
                    <SelectItem value="tenant">Tenant Name</SelectItem>
                    <SelectItem value="unit">Unit Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="property">Filter by Property</Label>
                <Select
                  value={selectedProperty}
                  onValueChange={(value) => {
                    setSelectedProperty(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger id="property" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Statements Table */}
          <Card className="border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : statements.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No statements found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedProperty !== "all"
                    ? "Try adjusting your search or filters."
                    : "Statements will appear here once generated for your units."}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Base Rent</TableHead>
                      <TableHead className="text-right">Late Fees</TableHead>
                      <TableHead className="text-right">Total Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statements.map((statement) => (
                      <TableRow key={statement.id}>
                        <TableCell className="font-medium">
                          {formatPeriodMonth(statement.period_month)}
                        </TableCell>
                        <TableCell>{statement.property_name}</TableCell>
                        <TableCell>Unit {statement.unit_number}</TableCell>
                        <TableCell>
                          {statement.tenant_name || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          ${statement.base_rent.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {(statement.late_fee || 0) + (statement.additional_fees || 0) > 0 ? (
                            <span className="text-amber-600">
                              ${((statement.late_fee || 0) + (statement.additional_fees || 0)).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">$0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${statement.total_due.toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(statement.status)}</TableCell>
                        <TableCell className="text-center">
                          {generatingPdf === statement.id ? (
                            <Button variant="ghost" size="sm" disabled>
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </Button>
                          ) : statement.pdf_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary"
                              onClick={() => window.open(statement.pdf_url!, "_blank")}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generatePdf(statement.id)}
                            >
                              Generate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                      {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} statements
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "ghost"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* Section 2: Yearly Summary by Property */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Yearly Summary by Property</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Up-to-date summaries</span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : yearlySummaries.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No yearly summaries available</h3>
              <p className="text-muted-foreground">
                Summaries will appear here once you have statements for your properties.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Group by year */}
              {Object.entries(
                yearlySummaries.reduce((acc, summary) => {
                  if (!acc[summary.year]) {
                    acc[summary.year] = [];
                  }
                  acc[summary.year].push(summary);
                  return acc;
                }, {} as Record<string, YearlySummary[]>)
              )
                .sort(([yearA], [yearB]) => yearB.localeCompare(yearA))
                .map(([year, summaries]) => (
                  <div key={year}>
                    <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {year}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {summaries.map((summary) => (
                        <Card key={`${summary.year}-${summary.propertyId}`} className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-primary" />
                              <h4 className="text-lg font-semibold text-foreground">
                                {summary.propertyName}
                              </h4>
                            </div>
                            <Badge variant="outline">{summary.totalStatements} statements</Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Total Base Rent</p>
                              <p className="text-lg font-semibold text-foreground">
                                ${summary.totalBaseRent.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Total Fees</p>
                              <p className="text-lg font-semibold text-amber-600">
                                ${(summary.totalLateFees + summary.totalAdditionalFees + summary.totalSplitFees).toLocaleString()}
                              </p>
                              {/* Detailed fee breakdown */}
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {summary.totalLateFees > 0 && (
                                  <div className="flex justify-between">
                                    <span>Late Fees:</span>
                                    <span>${summary.totalLateFees.toLocaleString()}</span>
                                  </div>
                                )}
                                {summary.totalAdditionalFees > 0 && (
                                  <div className="flex justify-between">
                                    <span>Additional Fees:</span>
                                    <span>${summary.totalAdditionalFees.toLocaleString()}</span>
                                  </div>
                                )}
                                {summary.totalSplitFees > 0 && (
                                  <div className="flex justify-between">
                                    <span>Split Payment Fees:</span>
                                    <span>${summary.totalSplitFees.toLocaleString()}</span>
                                  </div>
                                )}
                                {summary.totalLateFees === 0 && summary.totalAdditionalFees === 0 && summary.totalSplitFees === 0 && (
                                  <div className="text-muted-foreground">No fees</div>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
                              <p className="text-lg font-semibold text-emerald-600">
                                ${summary.totalPaid.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Total Unpaid</p>
                              <p className="text-lg font-semibold text-destructive">
                                ${summary.totalUnpaid.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">Total Due</span>
                              <span className="text-xl font-bold text-foreground">
                                ${summary.totalDue.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
