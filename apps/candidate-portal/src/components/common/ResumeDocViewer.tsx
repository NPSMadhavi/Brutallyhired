import React, { useEffect, useRef, useState } from "react";
import { getDocumentProxy } from "unpdf";
import { Download, ExternalLink } from "../ui/icons";

interface ResumeDocViewerProps {
  url: string;
  filename?: string;
  className?: string;
}

export const ResumeDocViewer: React.FC<ResumeDocViewerProps> = ({
  url,
  filename = "Resume.pdf",
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.35);
  const [pdfProxy, setPdfProxy] = useState<any>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Load PDF Proxy
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch resume file (${response.status} ${response.statusText})`);
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const proxy = await getDocumentProxy(new Uint8Array(buffer));
        if (cancelled) return;

        setPdfProxy(proxy);
        setNumPages(proxy.numPages);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error("ResumeDocViewer load error:", err);
        setError(err?.message || "Could not load resume document.");
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Render pages when pdfProxy or scale changes
  useEffect(() => {
    if (!pdfProxy || numPages === 0) return;

    let cancelled = false;

    const renderPages = async () => {
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (cancelled) break;
        try {
          const page = await pdfProxy.getPage(pageNum);
          if (cancelled) break;

          const canvas = canvasRefs.current.get(pageNum);
          if (!canvas) continue;

          // Compute viewport with device pixel ratio for ultra-crisp text
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: scale * dpr });
          const displayViewport = page.getViewport({ scale });

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${displayViewport.width}px`;
          canvas.style.height = `${displayViewport.height}px`;

          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) continue;

          // Fill white background before rendering
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;
        } catch (renderErr) {
          console.warn(`Error rendering page ${pageNum}:`, renderErr);
        }
      }
    };

    renderPages();

    return () => {
      cancelled = true;
    };
  }, [pdfProxy, numPages, scale]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 2.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.8));
  const handleResetZoom = () => setScale(1.35);

  return (
    <div className={`relative flex flex-col rounded-xl overflow-hidden border border-line bg-[#f8fafc] ${className}`}>
      {/* Clean Document View Controls (Subtle, non-intrusive, pure white/gray - NO black bars) */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-line text-xs text-ink-2 select-none shadow-sm">
        <div className="flex items-center gap-2 font-medium text-ink">
          <span>{filename}</span>
          {numPages > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] text-ink-3">
              {numPages} {numPages === 1 ? "page" : "pages"}
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded border border-line hover:bg-slate-100 text-ink font-bold transition-colors"
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 h-7 flex items-center justify-center rounded border border-line hover:bg-slate-100 text-[11px] font-medium text-ink transition-colors"
            title="Reset zoom"
          >
            {Math.round((scale / 1.35) * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded border border-line hover:bg-slate-100 text-ink font-bold transition-colors"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Document Body */}
      <div
        ref={containerRef}
        className="w-full flex-1 overflow-auto p-4 md:p-6 flex flex-col items-center justify-start gap-6 bg-[#eaecf0]/60 min-h-[500px]"
      >
        {loading && (
          <div className="my-auto flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="w-9 h-9 border-3 border-teal border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-ink-2">Rendering authentic resume document...</p>
          </div>
        )}

        {error && (
          <div className="my-auto max-w-md p-6 text-center bg-white rounded-xl border border-line shadow-sm space-y-3">
            <p className="text-xs text-rose-600 font-medium">Failed to render resume document preview.</p>
            <p className="text-[11px] text-ink-3">{error}</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink hover:bg-slate-50"
              >
                <ExternalLink size={13} />
                <span>Open in Tab</span>
              </a>
              <a
                href={url}
                download={filename}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal text-white text-xs font-semibold hover:bg-teal-hover"
              >
                <Download size={13} />
                <span>Download</span>
              </a>
            </div>
          </div>
        )}

        {!loading && !error && numPages > 0 && (
          <div className="flex flex-col items-center gap-6">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                className="bg-white rounded-lg shadow-xl border border-slate-300/80 overflow-hidden transition-shadow"
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNum, el);
                    else canvasRefs.current.delete(pageNum);
                  }}
                  className="block mx-auto max-w-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
