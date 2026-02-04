/**
 * Configure Mozilla PDF.js worker. Must run once before using react-pdf Document/Page.
 * Uses CDN so no copy of worker file is needed.
 */
import * as pdfjs from "pdfjs-dist";

const workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
