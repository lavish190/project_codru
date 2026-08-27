import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, FileText } from "lucide-react";

const PlanViewer = () => {
  const { id } = useParams(); // Grabs the ID from /plan-details/:id
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leadData, setLeadData] = useState(null);

  useEffect(() => {
    const fetchBrochureData = async () => {
      try {
        // Fetch the user's name and plan name securely
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f4f1]">
        <Loader2 className="w-12 h-12 text-[#ed7f23] animate-spin mb-4" />
        <h2 className="text-[#1765a4] text-xl font-bold font-display">Unlocking your brochure...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f4f1] p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops! Link Invalid</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <a href="https://curiousteamlearning.com" className="bg-[#1765a4] text-white px-6 py-3 rounded-full font-bold shadow-lg hover:-translate-y-1 transition-transform">
          Return to Homepage
        </a>
      </div>
    );
  }

  // 🚨 The secure URL from your backend for viewing
  const securePdfUrl = `https://api.curiousteamlearning.com/api/view-pdf/${id}`;

  return (
    <div className="min-h-screen bg-[#f7f4f1] flex flex-col">
      {/* Top Navigation Bar */}
      <div className="bg-white shadow-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="bg-[#1765a4]/10 p-2 rounded-xl">
            <FileText className="w-6 h-6 text-[#1765a4]" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-[#1765a4] leading-tight">
              {leadData?.plan_interest}
            </h1>
            <p className="text-sm text-gray-500 font-medium">Prepared exclusively for {leadData?.name}</p>
          </div>
        </div>
      </div>

      {/* The PDF Viewer iframe - securely streams from backend without toolbars */}
      <div className="flex-grow w-full h-[calc(100vh-80px)] bg-gray-100">
        <iframe 
          src={`${securePdfUrl}#toolbar=0`} 
          className="w-full h-full border-none shadow-inner"
          title={`${leadData?.plan_interest} Brochure`}
        >
          <p>Your browser does not support PDFs.</p>
        </iframe>
      </div>
    </div>
  );
};

export default PlanViewer;