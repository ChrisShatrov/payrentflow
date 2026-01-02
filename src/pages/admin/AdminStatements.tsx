import { AdminLayout } from "@/components/admin/AdminLayout";

export default function AdminStatements() {
  return (
    <AdminLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Statements</h1>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Statements management coming soon...</p>
        </div>
      </div>
    </AdminLayout>
  );
}
