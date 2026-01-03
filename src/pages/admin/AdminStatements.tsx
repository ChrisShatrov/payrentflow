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
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StatementData {
  id: string;
  period_month: string;
  base_rent: number;
  late_fee: number | null;
  additional_fees: number | null;
  total_due: number;
  status: string;
  pdf_url: string | null;
  created_at: string | null;
  unit_number: string;
  property_name: string;
  tenant_name: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function AdminStatements() {
  const { user } = useAuth();
  const [statements, setStatements] = useState<StatementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchStatements();
    }
  }, [user, currentPage]);

  const fetchStatements = async () => {
    setLoading(true);
    try {
      // First get count for pagination
      const { count, error: countError } = await supabase
        .from("statements")
        .select("*, units!inner(property_id, properties!inner(landlord_id))", { count: "exact", head: true })
        .eq("units.properties.landlord_id", user?.id);

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Fetch statements with pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

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
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const formattedStatements: StatementData[] = (data || []).map((s: any) => ({
        id: s.id,
        period_month: s.period_month,
        base_rent: s.base_rent,
        late_fee: s.late_fee,
        additional_fees: s.additional_fees,
        total_due: s.total_due,
        status: s.status,
        pdf_url: s.pdf_url,
        created_at: s.created_at,
        unit_number: s.units?.unit_number || "N/A",
        property_name: s.units?.properties?.name || "N/A",
        tenant_name: s.units?.profiles?.full_name || null,
      }));

      setStatements(formattedStatements);
    } catch (error) {
      console.error("Error fetching statements:", error);
    } finally {
      setLoading(false);
    }
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
        setStatements((prev) =>
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
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Statements</h1>
            <p className="text-muted-foreground mt-1">
              View and download rent statements for all units
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{totalCount} total statements</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : statements.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No statements yet</h3>
              <p className="text-muted-foreground">
                Statements will appear here once generated for your units.
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
        </div>
      </div>
    </AdminLayout>
  );
}
