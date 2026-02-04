import { useState, useEffect, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Ensure PDF.js worker is set (CDN so no build copy needed)
if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions.workerSrc === "pdf.worker.mjs") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export type PdfViewerSource =
  | { type: "url"; url: string }
  | { type: "blob"; blob: Blob };

export interface PdfViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PDF source: URL (string) or blob from fetch */
  source: PdfViewerSource | null;
  /** Optional filename for the Download button */
  downloadFilename?: string;
  /** Title shown in the modal header */
  title?: string;
}

export function PdfViewerModal({
  open,
  onOpenChange,
  source,
  downloadFilename,
  title = "PDF",
}: PdfViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!source || source.type !== "blob") {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        setBlobUrl(null);
      }
      return;
    }
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(source.blob);
    blobUrlRef.current = url;
    setBlobUrl(url);
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [source]);

  const file = useMemo(() => {
    if (!source) return null;
    if (source.type === "url") return source.url;
    if (source.type === "blob" && blobUrl) return blobUrl;
    return null;
  }, [source, blobUrl]);

  useEffect(() => {
    if (!open) {
      setPageNumber(1);
      setNumPages(0);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const onLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNumber(1);
    setLoading(false);
    setError(null);
  };

  const onLoadError = (err: Error) => {
    setError(err?.message ?? "Failed to load PDF");
    setLoading(false);
  };

  const handleDownload = () => {
    if (!file) return;
    const a = document.createElement("a");
    a.href = file;
    a.download = downloadFilename ?? "document.pdf";
    a.rel = "noopener";
    a.click();
  };

  const canPrev = pageNumber > 1;
  const canNext = pageNumber < numPages;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogDescription className="sr-only">PDF document viewer</DialogDescription>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              {numPages > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!canPrev}
                    onClick={() => setPageNumber((p) => p - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {pageNumber} / {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!canNext}
                    onClick={() => setPageNumber((p) => p + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!file}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-[60vh] px-6 py-4">
          {!file && !loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              No document to display.
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-16 text-destructive">
              {error}
            </div>
          )}
          {file && !error && (
            <div className="flex flex-col items-center">
              <Document
                file={file}
                onLoadSuccess={onLoadSuccess}
                onLoadError={onLoadError}
                loading={
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                {numPages > 0 && (
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer
                    renderAnnotationLayer
                  />
                )}
              </Document>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
