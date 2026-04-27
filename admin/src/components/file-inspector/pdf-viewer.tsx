import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Spin, Alert } from "antd";

interface PDFViewerProps {
  fileUrl: string;
  onPageCountExtracted: (count: number) => void;
}

export function PDFViewer({ fileUrl, onPageCountExtracted }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPDF = async () => {
      try {
        setLoading(true);
        // Fetch the PDF to extract page count
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch PDF file. Check CORS or URL validity.");
        }
        const arrayBuffer = await response.arrayBuffer();
        
        // Load PDF and get page count
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();
        
        if (isMounted) {
          onPageCountExtracted(pageCount);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to parse PDF");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchPDF();

    return () => {
      isMounted = false;
    };
  }, [fileUrl, onPageCountExtracted]);

  return (
    <div style={{ width: "100%", height: "60vh", position: "relative" }}>
      {loading && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
          <Spin size="large" tip="Loading PDF..." />
        </div>
      )}
      {error && (
        <Alert
          message="Error Loading PDF"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <iframe
        src={fileUrl}
        width="100%"
        height="100%"
        style={{ border: "none" }}
        title="PDF Preview"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
