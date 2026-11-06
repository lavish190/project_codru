import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  Route,
  Routes,
  useLocation,
  Navigate,
  useSearchParams
} from "react-router-dom";

import { registerSW } from 'virtual:pwa-register';

import PwaInstallPrompt from "./PwaInstallPrompt";
import Home from "./components/Home";
import Navbar from "./components/Navbar";
import Popup from "./components/Popup";
import NotFound from "./components/NotFound";

const Dashboard = lazy(() => import("./components/Dashboard"));
const Signin = lazy(() => import("./components/Signin"));
const Signup = lazy(() => import("./components/Signup"));
const Explore = lazy(() => import("./components/Explore"));
const Publicprofile = lazy(() => import("./components/Publicprofile"));
const SinglePost = lazy(() => import("./components/SinglePost"));
const CommunicationPortal = lazy(() => import("./components/CommunicationPortal"));

const SyllabusExplorer = lazy(() => import("./components/SyllabusExplorer"));
const TaskForm = lazy(() => import("./components/TaskForm"));
const PlanViewer = lazy(() => import("./components/PlanViewer"));

const AdmissionPortal = lazy(() => import("./components/Admission/AdmissionPortal"));
const InternshipPortal = lazy(() => import("./components/InternshipPortal"));

const PaymentHistory = lazy(() => import("./components/PaymentHistory"));
const PaymentStatus = lazy(() => import("./components/PaymentStatus"));
const EnrollPage = lazy(() => import("./components/Enrol"));
const ForgetPassword = lazy(() => import("./components/Forget_password"));

// --- TYPESCRIPT DEFINITIONS ---
export interface UserData {
  _id: string;
  Name: string;
  Photo: string;
  Role: string;
  isAdmin: boolean;
  isVerifiedStaff: boolean;
  staffApprovalRequested: boolean;
  isVerifiedParent: boolean;
  parentVerificationRequested: boolean;
  dashboardLayout?: any[];
  isCuTeTeam?: boolean;
  isCounselor?: boolean;
}

// Helper for Web Push VAPID keys
const urlBase64ToUint8Array = (base64String: string) => {

  const padding =
    '='.repeat((4 - base64String.length % 4) % 4);

  const base64 =
    (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

  const rawData = window.atob(base64);

  return new Uint8Array(
    [...rawData].map((char) =>
      char.charCodeAt(0)
    )
  );
};

function App() {

  const [userData, setUserData] =
    useState<UserData>({
      _id: "",
      Name: "",
      Photo: "",
      Role: "",
      isAdmin: false,
      isVerifiedStaff: false,
      staffApprovalRequested: false,
      isVerifiedParent: false,
      parentVerificationRequested: false,
      dashboardLayout: [],
      isCuTeTeam: false,
      isCounselor: false
    });

  const [isAuthLoading, setIsAuthLoading] =
    useState(true);

  const [isOnline, setIsOnline] =
    useState(navigator.onLine);

  const [isServerVerified, setIsServerVerified] =
    useState(false);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const [showRolePopup, setShowRolePopup] =
    useState(false);

  const location = useLocation();

  const isAuth =
    !!localStorage.getItem("jwtoken");

  useEffect(() => {

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {

      window.removeEventListener(
        'online',
        handleOnline
      );

      window.removeEventListener(
        'offline',
        handleOffline
      );

    };
  }, []);

  // Silent Push Sync
  useEffect(() => {

    if (!isAuth) return;

    const silentlySyncPushSubscription =
      async () => {

        if (
          !("serviceWorker" in navigator) ||
          !("PushManager" in window)
        ) return;

        if (Notification.permission !== "granted")
          return;

        try {

          const registration =
            await navigator.serviceWorker.ready;

          let subscription =
            await registration.pushManager
              .getSubscription();

          if (!subscription) {

            const publicVapidKey =
              import.meta.env.VITE_VAPID_PUBLIC_KEY;

            if (!publicVapidKey) return;

            subscription =
              await registration.pushManager
                .subscribe({
                  userVisibleOnly: true,
                  applicationServerKey:
                    urlBase64ToUint8Array(
                      publicVapidKey
                    ),
                });

          }

          const token =
            localStorage.getItem("jwtoken");

          if (!token || !subscription) return;

          await fetch(
            `${import.meta.env.VITE_API}save-subscription`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization":
                  `Bearer ${token}`
              },
              body: JSON.stringify({
                subscription
              }),
            }
          );

          console.log(
            "✅ Push subscription synced!"
          );

        } catch (error) {

          console.error(
            "Silent push sync failed:",
            error
          );

        }

      };

    const syncTimeout =
      setTimeout(() => {
        silentlySyncPushSubscription();
      }, 2000);

    return () => clearTimeout(syncTimeout);

  }, [isAuth]);

  useEffect(() => {

    if ('serviceWorker' in navigator) {

      registerSW({
        immediate: true
      });

    }

  }, []);

  useEffect(() => {

    const initializeAuth = async () => {

      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');
      const isNewUser = urlParams.get('new') === 'true';

      if (tokenFromUrl) {
        localStorage.setItem("jwtoken", tokenFromUrl);
      }

      if (isNewUser) {
        setShowRolePopup(true);
      }

      if (tokenFromUrl || isNewUser) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const activeToken = localStorage.getItem("jwtoken");

      if (activeToken) {

        try {
          const res = await fetch(
            `${import.meta.env.VITE_API}profile`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${activeToken}`
              }
            }
          );

          // 🚨 Intercept expired/invalid tokens and auto-logout!
          if (res.status === 401) {
            console.warn("Token expired. Auto-logging out...");
            localStorage.removeItem("jwtoken");
            localStorage.removeItem("Username");
            localStorage.removeItem("userId");
            localStorage.removeItem("Photo");
            localStorage.removeItem("Name");
            
            // Redirect to signin smoothly
            window.location.href = "/signin";
            return;
          }

          const data = await res.json();

          if (res.ok && data.user) {
            // ==========================================
            // 🚨 SMART RENEWAL: Save the new token if backend provided one
            // ==========================================
            if (data.newToken) {
              console.log("Session automatically extended for 14 days.");
              localStorage.setItem("jwtoken", data.newToken);
            }

            localStorage.setItem("Username", data.user.username);
            localStorage.setItem("userId", data.user._id);
            localStorage.setItem("Photo", data.user.photo || "");
            localStorage.setItem("Name", data.user.name || "");

            setUserData({
              _id: data.user._id,
              Photo: data.user.photo?.toString() || "",
              Name: data.user.name?.toString() || "",
              Role: data.user.role?.toString() || "",
              isAdmin: data.user.isAdmin || false,
              isVerifiedStaff: data.user.isVerifiedStaff || false,
              staffApprovalRequested: data.user.staffApprovalRequested || false,
              isVerifiedParent: data.user.isVerifiedParent || false,
              parentVerificationRequested: data.user.parentVerificationRequested || false,
              dashboardLayout: data.user.dashboardLayout || [],
              isCuTeTeam: data.user.isCuTeTeam || false,
              isCounselor: data.user.isCounselor || false,
            });

            setIsServerVerified(true);
          }
        } catch (error) {
          console.error("Network error fetching user profile:", error);
        } finally {
          setIsAuthLoading(false);
        }
      } else {
        setIsAuthLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const hideNavbar =

    location.pathname.startsWith("/dashboard") ||

    location.pathname.startsWith("/admin") ||

    location.pathname.startsWith("/assign-task");

  const PublicRoute = ({
    children
  }: {
    children: React.ReactElement
  }) => {

    if (isAuthLoading) {

      return (

        <div
          className="
          min-h-screen
          bg-slate-50
          flex
          items-center
          justify-center"
        >

          <div
            className="
            w-8
            h-8
            border-4
            border-brand-orange
            border-t-transparent
            rounded-full
            animate-spin"
          />

        </div>

      );

    }

    if (localStorage.getItem("jwtoken")) {

      return (
        <Navigate
          to="/dashboard"
          replace
        />
      );

    }

    return children;

  };

  const ProtectedRoute = ({
    children
  }: {
    children: React.ReactElement
  }) => {

    if (isAuthLoading) {

      return (

        <div
          className="
          min-h-screen
          bg-slate-50
          flex
          items-center
          justify-center"
        >

          <div
            className="
            w-8
            h-8
            border-4
            border-brand-orange
            border-t-transparent
            rounded-full
            animate-spin"
          />

        </div>

      );

    }

    if (!localStorage.getItem("jwtoken")) {

      sessionStorage.setItem(
        "redirectPath",
        location.pathname
      );

      return (
        <Navigate
          to="/signin"
          replace
        />
      );

    }

    return children;

  };

  return (

    <div
      className="
      min-h-screen
      bg-slate-50
      text-gray-900
      font-sans
      selection:bg-brand-orange
      selection:text-white"
    >

      <PwaInstallPrompt />

      {!hideNavbar && (

        <Navbar
          userData={userData}
          setUserData={setUserData}
        />

      )}

      <Popup
        isOpen={showRolePopup}
        onRoleSelected={(newRole) => {

          setUserData(prev => ({
            ...prev,
            Role: newRole
          }));

          setShowRolePopup(false);

        }}
      />

      {!isOnline ? (

        <NotFound mode="offline" />

      ) : (

        <>
          <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Routes>

              <Route
                path="/post/:postId"
                element={
                  <SinglePost
                    userData={userData}
                  />
                }
              />

              <Route
                path="/profile/:username"
                element={<Publicprofile />}
              />

              <Route
                path="/"
                element={
                  <Home userData={userData} />
                }
              />

              <Route
                path="/signup"
                element={
                  <PublicRoute>
                    <Signup />
                  </PublicRoute>
                }
              />

              <Route
                path="/signin"
                element={
                  <PublicRoute>
                    <Signin
                      userData={userData}
                      setUserData={setUserData}
                    />
                  </PublicRoute>
                }
              />

              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute>
                    <Dashboard
                      userData={userData}
                      setUserData={setUserData}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/update-report/:username"
                element={
                  <ProtectedRoute>
                    <TaskForm />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/forget-password/:token"
                element={<ForgetPassword />}
              />

              <Route
                path="/edit-syllabus"
                element={
                  <SyllabusExplorer
                    userData={userData}
                  />
                }
              />

              <Route 
                path="/explore" 
                element={
                  <Explore 
                    currentUser={{ 
                      id: localStorage.getItem("userId"), 
                      photo: userData?.Photo 
                    }} 
                  />
                } 
              />

              <Route
                path="/edit-syllabus/:username"
                element={
                  <SyllabusExplorer
                    userData={userData}
                  />
                }
              />

              {/* PAYMENT SUCCESS */}
              <Route
                path="/payment-status"
                element={<PaymentStatus />}
              />

              {/* PAYMENT HISTORY */}
              <Route
                path="/payment-history"
                element={<PaymentHistory />}
              />

              {/* ENROLLMENT PAGE */}
              <Route
                path="/enroll"
                element={<EnrollPage />}
              />
              {/* INTERNSHIP PORTAL */}
              <Route
                path="/work-with-us"
                element={<InternshipPortal />}
              />

              <Route 
                path="/plan-details/:id" 
                element={<PlanViewer />} 
              />

              <Route
                path="//homeschool-application"
                element={<AdmissionPortal />}
              />

              {/* NOT FOUND */}
              <Route
                path="*"
                element={<NotFound />}
              />

            </Routes>

            {isAuth && (
              <CommunicationPortal />
            )}
          </Suspense>
        </>
      )}
    </div>
  );
}

export default App;