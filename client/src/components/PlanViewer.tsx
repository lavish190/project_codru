import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, FileText, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

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

  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
    }
  }, []);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); 
        setZoom(prev => Math.min(Math.max(0.5, prev + (e.deltaY > 0 ? -0.1 : 0.1)), 4));
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  const handleScroll = (e) => {
    const currentScrollY = e.target.scrollTop;
    if (currentScrollY > lastScrollY && currentScrollY > 60) {
      setShowNav(false);
    } else if (currentScrollY < lastScrollY) {
      setShowNav(true);
    }
    setLastScrollY(currentScrollY);
  };

  const handleInternalLinkClick = ({ pageNumber }) => {
    const targetPage = document.getElementById(`pdf-page-${pageNumber}`);
    const scrollContainer = document.getElementById('pdf-scroll-container');
    
    if (targetPage && scrollContainer) {
      scrollContainer.scrollTo({
        top: targetPage.offsetTop - 100, 
        behavior: 'smooth'
      });
    }
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
  const basePdfWidth = Math.min(containerWidth * 0.95, 800);

  return (
    <div 
      className="relative flex flex-col w-full h-full min-h-screen bg-[#e2e8f0]" 
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 🚨 FORCED VISIBLE SCROLLBAR CSS */}
      <style>
        {`
          #pdf-scroll-container {
            scrollbar-width: thin;
            scrollbar-color: #1765a4 #cbd5e1;
          }
          #pdf-scroll-container::-webkit-scrollbar {
            width: 12px !important;
            display: block !important;
          }
          #pdf-scroll-container::-webkit-scrollbar-track {
            background: #cbd5e1 !important;
          }
          #pdf-scroll-container::-webkit-scrollbar-thumb {
            background-color: #1765a4 !important;
            border-radius: 6px !important;
            border: 2px solid #cbd5e1 !important;
          }
          #pdf-scroll-container::-webkit-scrollbar-thumb:hover {
            background-color: #ed7f23 !important;
          }
        `}
      </style>
      
      {/* HEADER */}
      <div className={`fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-40 transition-transform duration-300 ease-in-out ${showNav ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-[#1765a4]/10 p-2 rounded-xl">
            <FileText className="w-6 h-6 text-[#1765a4]" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-[#1765a4] leading-tight">
              Cute Learning Complete Guide
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

      {/* FLOATING ZOOM CONTROLS */}
      <div className={`fixed bottom-8 right-8 flex flex-col gap-3 z-50 transition-opacity duration-300 ${showNav ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors border border-gray-200">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => setZoom(1)} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors border border-gray-200">
          <Maximize className="w-5 h-5" />
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="bg-white p-3 rounded-full shadow-xl text-[#1765a4] hover:bg-gray-50 transition-colors border border-gray-200">
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>

      {/* SCROLL CONTAINER */}
      <div 
        id="pdf-scroll-container"
        className="w-full h-screen overflow-y-scroll pt-24 pb-32"
        onScroll={handleScroll}
      >
        <div className="w-fit min-w-full mx-auto">
          <div ref={pdfWrapperRef} className="flex flex-col items-center px-4 origin-center">
            
            <Document
              file={securePdfUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onItemClick={handleInternalLinkClick}
              loading={<Loader2 className="w-10 h-10 text-[#1765a4] animate-spin mx-auto mt-10" />}
              error={<p className="text-red-500 mt-10 font-bold text-center">Failed to load the secure document.</p>}
              className="flex flex-col gap-8 pb-10" 
            >
              {Array.from(new Array(numPages), (el, index) => (
                <div 
                  key={`page_${index + 1}`} 
                  id={`pdf-page-${index + 1}`}
                  className="mb-8 shadow-2xl rounded-sm bg-white overflow-hidden shrink-0 border border-gray-200 relative"
                >
                  <Page
                    pageNumber={index + 1}
                    width={basePdfWidth}
                    scale={zoom} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={true} 
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