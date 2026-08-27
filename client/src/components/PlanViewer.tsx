import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, FileText, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

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
  
  // States for hiding/showing the title bar
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Keep the PDF responsive on window resize
  useEffect(() => {
    const handleResize = () => setContainerWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Handle hiding/showing the title bar on scroll
  const handleScroll = (e) => {
    const currentScrollY = e.target.scrollTop;
    // Hide title bar if scrolling down past 60px, show if scrolling up
    if (currentScrollY > lastScrollY && currentScrollY > 60) {
      setShowNav(false);
    } else if (currentScrollY < lastScrollY) {
      setShowNav(true);
    }
    setLastScrollY(currentScrollY);
  };

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  // Prevent right-click context menu on the PDF wrapper
  const handleContextMenu = (e) => {
    e.preventDefault();
  };

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
  const pdfWidth = Math.min(containerWidth * 0.95, 800);

  return (
    // ✅ FIX 2: Changed from h-screen to relative flex-grow. This allows your main website Navbar to sit safely above it.
    <div 
      className="relative flex flex-col flex-grow w-full bg-[#e2e8f0] overflow-hidden" 
      style={{ height: 'calc(100vh - 64px)' }} // Adjust the 64px if your main navbar is taller/shorter
      onContextMenu={handleContextMenu}
    >
      
      {/* 🌟 AUTO-HIDING TITLE BAR */}
      {/* ✅ FIX 3: Changed from 'fixed' to 'absolute'. It will now hide underneath your main Navbar instead of overlapping it */}
      <div 
        className={`absolute top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-40 transition-transform duration-300 ease-in-out ${showNav ? 'translate-y-0' : '-translate-y-full'}`}
      >
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

      {/* 🌟 NATIVE SCROLL & ZOOM CONTAINER */}
      <div 
        className="flex-grow w-full h-full overflow-y-auto touch-pan-y overscroll-none pt-24 pb-10 flex flex-col items-center" 
        onScroll={handleScroll}
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          // Only zoom if Ctrl/Cmd is held (Desktop), prevents accidental zoom while scrolling pages
          wheel={{ activationKeys: ["Control", "Meta"] }} 
          pinch={{ step: 5 }} // Native touchscreen pinch zoom for Android/iOS
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Floating Zoom Controls (Fades out when scrolling down) */}
              <div className={`fixed bottom-6 right-6 flex flex-col gap-3 z-50 transition-opacity duration-300 ${showNav ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}>
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

              {/* The Zoomable Canvas Area */}
              <TransformComponent wrapperStyle={{ width: "100%", height: "auto" }}>
                <Document
                  file={securePdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<Loader2 className="w-10 h-10 text-[#1765a4] animate-spin mt-10" />}
                  error={<p className="text-red-500 mt-10 font-bold">Failed to load the secure document.</p>}
                  className="flex flex-col items-center w-full"
                >
                  {Array.from(new Array(numPages), (el, index) => (
                    <div key={`page_${index + 1}`} className="mb-6 shadow-2xl rounded-sm overflow-hidden bg-white shrink-0">
                      <Page
                        pageNumber={index + 1}
                        width={pdfWidth}
                        renderTextLayer={false} // Disables text selection
                        renderAnnotationLayer={false} // Disables hyperlink interactions
                        loading={<div className="h-96 flex items-center justify-center bg-gray-50"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>}
                      />
                    </div>
                  ))}
                </Document>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
};

export default PlanViewer;