import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const [email, setEmail] = useState(currentEmail);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

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
        redirectTo: `${window.location.origin}/auth?mode=reset`,
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
