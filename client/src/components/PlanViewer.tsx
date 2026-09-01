import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, FileText, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

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
  const [zoom, setZoom] = useState(1);
  const pdfWrapperRef = useRef(null); 
  
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

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

  // 🌟 1. VIEWPORT LOCK (Blocks whole-window zooming)
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta ? viewportMeta.getAttribute('content') : '';
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    return () => {
      if (viewportMeta && originalViewport) viewportMeta.setAttribute('content', originalViewport);
    };
  }, []);

  // 🌟 2. DESKTOP ZOOM (Ctrl + Wheel)
  useEffect(() => {
    const container = document.getElementById('pdf-scroll-container');
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); 
        setZoom(prev => {
          const newZoom = e.deltaY > 0 ? prev - 0.1 : prev + 0.1;
          return Math.min(Math.max(0.5, newZoom), 4); 
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // 🌟 3. MOBILE PINCH ZOOM (Strictly handles 2 fingers only, leaves 1 finger to native scroll)
  useEffect(() => {
    const wrapper = pdfWrapperRef.current;
    if (!wrapper) return;
    
    let initialDist = 0;
    let pinchScale = 1;

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        initialDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchScale = 1;
      }
    };

    const handleTouchMove = (e) => {
      console.log("Touch move fired! Fingers on screen:", e.touches.length);
      if (e.touches.length === 2) {
        if (e.cancelable) e.preventDefault(); // 🚨 ONLY block default if there are exactly 2 fingers!
        
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        if (initialDist === 0) initialDist = currentDist; // Catch mid-swipe double touches

        if (initialDist > 0) {
          pinchScale = currentDist / initialDist;
          wrapper.style.transform = `scale(${pinchScale})`;
          wrapper.style.transformOrigin = "top center";
          wrapper.style.transition = "none";
        }
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2 && initialDist > 0) {
        if (pinchScale !== 1) {
          setZoom(prev => Math.min(Math.max(0.5, prev * pinchScale), 4));
        }
        wrapper.style.transform = `scale(1)`;
        initialDist = 0;
        pinchScale = 1;
      }
    };

    wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
    wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
    wrapper.addEventListener('touchend', handleTouchEnd);

    return () => {
      wrapper.removeEventListener('touchstart', handleTouchStart);
      wrapper.removeEventListener('touchmove', handleTouchMove);
      wrapper.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Navbar Auto-Hide Logic
  const handleScroll = (e) => {
    const currentScrollY = e.target.scrollTop;
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
    // 🚨 FIX 1: "fixed inset-0" ensures the window itself NEVER scrolls on mobile, only the inner container.
    <div 
      className="fixed inset-0 bg-[#e2e8f0] overflow-hidden" 
      onContextMenu={handleContextMenu}
    >
      
      {/* 🌟 AUTO-HIDING TITLE BAR */}
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

      {/* 🌟 FLOATING ZOOM CONTROLS */}
      <div className={`fixed bottom-[12dvh] right-4 md:bottom-8 md:right-8 flex flex-col gap-3 z-50 transition-opacity duration-300 ${showNav ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => setZoom(1)} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors">
          <Maximize className="w-5 h-5" />
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors">
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>

      {/* 🌟 NATIVE SCROLL CONTAINER */}
      <div 
        id="pdf-scroll-container"
        className="absolute inset-0 overflow-auto pt-24 pb-32" 
        style={{ border: '5px solid red' }} // 🚨 FIX 2: Restores native momentum swipe on iPhones
        onScroll={handleScroll}
      >
        {/* w-fit min-w-full prevents left-side clipping when zoomed */}
        <div className="w-fit min-w-full mx-auto" style={{ border: '5px solid blue' }}>
          {/* Target for our CSS Pinch Zoom layer */}
          <div ref={pdfWrapperRef} className="flex flex-col items-center px-4 origin-top">
            
            <Document
              file={securePdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<Loader2 className="w-10 h-10 text-[#1765a4] animate-spin mx-auto mt-10" />}
              error={<p className="text-red-500 mt-10 font-bold text-center">Failed to load the secure document.</p>}
              className="flex flex-col gap-8 pb-10" 
            >
              {Array.from(new Array(numPages), (el, index) => (
                <div key={`page_${index + 1}`} className="mb-8 shadow-2xl rounded-sm bg-white overflow-hidden shrink-0 border border-gray-200">
                  <Page
                    pageNumber={index + 1}
                    width={basePdfWidth}
                    scale={zoom} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false} 
                    loading={<div className="h-96 flex items-center justify-center bg-gray-50"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>}
                  />
                </div>
              ))}
            </Document>
            
          </div>
        </div>
      </div>

    </div>
  );
};

export default PlanViewer;