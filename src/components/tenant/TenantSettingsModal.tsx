import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Lock, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface TenantSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
}

export function TenantSettingsModal({ 
  open, 
  onOpenChange, 
  currentEmail 
}: TenantSettingsModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState(currentEmail);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [unit, setUnit] = useState<{ unit_number: string; allow_split_payment: boolean } | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchUnit();
    }
  }, [open, user]);

  const fetchUnit = async () => {
    try {
      const { data } = await supabase
        .from("units")
        .select("unit_number, allow_split_payment")
        .eq("tenant_id", user?.id)
        .maybeSingle();
      
      if (data) {
        setUnit(data);
      }
    } catch (error) {
      console.error("Error fetching unit:", error);
    }
  };

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || email === currentEmail) {
      toast({
        title: "No Changes",
        description: "Please enter a new email address",
        variant: "destructive",
      });
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      
      if (error) throw error;

      toast({
        title: "Verification Email Sent",
        description: "Please check your new email address to confirm the change.",
      });
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Email Sent",
        description: "Please check your email for the password reset link.",
      });
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>
            Update your email address or reset your password
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Email Update */}
          <form onSubmit={handleEmailUpdate} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="h-4 w-4" />
              Email Address
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your new email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={emailLoading}
              />
            </div>
            <Button type="submit" disabled={emailLoading || email === currentEmail} className="w-full">
              {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Email
            </Button>
          </form>

          <Separator />

          {/* Unit Information */}
          {unit && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Home className="h-4 w-4" />
                Unit Information
              </div>
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unit Number</span>
                  <span className="text-sm font-medium">Unit {unit.unit_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Split Payments</span>
                  <Badge variant={unit.allow_split_payment ? "default" : "secondary"}>
                    {unit.allow_split_payment ? "Allowed" : "Not Allowed"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Password Reset */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Lock className="h-4 w-4" />
              Password
            </div>
            <p className="text-sm text-muted-foreground">
              Click below to receive a password reset email
            </p>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handlePasswordReset}
              disabled={passwordLoading}
              className="w-full"
            >
              {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request Password Reset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
