import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddonChipProps {
  name: string;
  selected: boolean;
  price: number | null;
  onToggle: (name: string, price: number | null) => void;
}

export function AddonChip({ name, selected, price, onToggle }: AddonChipProps) {
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceInput, setPriceInput] = useState(price?.toString() || "");

  const handleClick = () => {
    if (selected) {
      // If already selected, clicking removes it
      onToggle(name, null);
    } else {
      // If not selected, open price dialog
      setPriceInput("");
      setPriceDialogOpen(true);
    }
  };

  const handlePriceSubmit = () => {
    const priceValue = parseFloat(priceInput);
    if (isNaN(priceValue) || priceValue < 0) {
      return; // Invalid price, don't submit
    }
    onToggle(name, priceValue);
    setPriceDialogOpen(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(name, null);
  };

  return (
    <>
      <Button
        type="button"
        variant={selected ? "default" : "outline"}
        className={cn(
          "relative h-auto py-2 px-3 text-sm",
          selected && "pr-8"
        )}
        onClick={handleClick}
      >
        {selected ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            {name}
            {price !== null && price > 0 && (
              <span className="ml-2 text-xs opacity-80">${price.toFixed(2)}</span>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-destructive/20 rounded"
              aria-label={`Remove ${name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            {name}
          </>
        )}
      </Button>

      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Price for {name}</DialogTitle>
            <DialogDescription>
              Enter the monthly price for this addon. This will be included in the base rent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="addonPrice">Monthly Price ($)</Label>
              <Input
                id="addonPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handlePriceSubmit();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPriceDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePriceSubmit}
              disabled={!priceInput || isNaN(parseFloat(priceInput)) || parseFloat(priceInput) < 0}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
