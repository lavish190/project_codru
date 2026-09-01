import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, FileText, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Load worker locally via Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PlanViewer = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leadData, setLeadData] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);

  // Keep the PDF responsive on window resize
  useEffect(() => {
    const handleResize = () => setContainerWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch API Data
  useEffect(() => {
    const fetchBrochureData = async () => {
      try {
        const response = await fetch(`https://api.curiousteamlearning.com/api/brochure-data/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load brochure.");
        setLeadData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBrochureData();
  }, [id]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  const handleContextMenu = (e) => e.preventDefault();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-[#f7f4f1]">
        <Loader2 className="w-12 h-12 text-[#ed7f23] animate-spin mb-4" />
        <h2 className="text-[#1765a4] text-xl font-bold font-display">Unlocking your brochure...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-[#f7f4f1] p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops! Link Invalid</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <a href="/" className="bg-[#1765a4] text-white px-6 py-3 rounded-full font-bold shadow-lg hover:-translate-y-1 transition-transform">
          Return to Homepage
        </a>
      </div>
    );
  }

  const securePdfUrl = `https://api.curiousteamlearning.com/api/view-pdf/${id}`;
  const basePdfWidth = Math.min(containerWidth * 0.95, 800);

  return (
    <div 
      className="relative flex flex-col w-full bg-[#e2e8f0] overflow-hidden" 
      style={{ height: 'calc(100vh - 64px)' }} 
      onContextMenu={handleContextMenu}
    >
      
      {/* 🌟 LOCKED TITLE BAR */}
      {/* Because the library handles scrolling internally now, we lock this at the top so it doesn't glitch */}
      <div className="absolute top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="bg-[#1765a4]/10 p-2 rounded-xl">
            <FileText className="w-6 h-6 text-[#1765a4]" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-[#1765a4] leading-tight">
              {leadData?.plan_interest}
            </h1>
            <p className="text-sm text-gray-500 font-medium hidden sm:block">
              Prepared exclusively for {leadData?.name}
            </p>
          </div>
        </div>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
          View Only
        </div>
      </div>

      {/* 🌟 NATIVE PAN & ZOOM CONTAINER */}
      {/* touchAction: 'none' tells the mobile browser to STOP everything, let the library do its job */}
      <div 
        className="absolute top-[80px] bottom-0 left-0 right-0 z-10" 
        style={{ touchAction: 'none' }} 
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          centerOnInit={true}
          centerZoomedOut={true}
          limitToBounds={false} // 🚨 FIX 1: Turns off the aggressive boundaries, totally fixing the "Left Scroll Stuck" bug!
          wheel={{ activationKeys: ["Control", "Meta"], step: 0.1 }} // Keeps Ctrl+Scroll for desktop
          pinch={{ step: 5 }} // Native touchscreen pinch zoom
          panning={{ velocityDisabled: false }} // Allows natural swipe momentum
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* 🌟 FLOATING ZOOM CONTROLS (Position Preserved!) */}
              <div className="fixed bottom-[12dvh] right-4 md:bottom-8 md:right-8 flex flex-col gap-3 z-50">
                <button onClick={() => zoomIn()} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors">
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button onClick={() => resetTransform()} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors">
                  <Maximize className="w-5 h-5" />
                </button>
                <button onClick={() => zoomOut()} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors">
                  <ZoomOut className="w-5 h-5" />
                </button>
              </div>

              {/* 🚨 FIX 2: Added flex centering to the contentStyle to align the PDF perfectly */}
              <TransformComponent 
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{ width: "100%", display: "flex", justifyContent: "center" }}
              >
                <div className="pb-32 pt-8"> 
                  <Document
                    file={securePdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<Loader2 className="w-10 h-10 text-[#1765a4] animate-spin mt-10" />}
                    error={<p className="text-red-500 mt-10 font-bold">Failed to load the secure document.</p>}
                    className="flex flex-col gap-8" // 🚨 FIX 3: Restores the 2rem gap between pages!
                  >
                    {Array.from(new Array(numPages), (el, index) => (
                      <div 
                        key={`page_${index + 1}`} 
                        className="shadow-2xl rounded-sm bg-white overflow-hidden shrink-0 border border-gray-200" // 🚨 FIX 4: Borders physically separate the pages
                      >
                        <Page
                          pageNumber={index + 1}
                          width={basePdfWidth}
                          renderTextLayer={false} 
                          renderAnnotationLayer={false} 
                          loading={<div className="h-96 flex items-center justify-center bg-gray-50"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>}
                        />
                      </div>
                    ))}
                  </Document>
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

    </div>
  );
};

export default PlanViewer;