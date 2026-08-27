import React, { useEffect, useState } from "react";
import {
  Route,
  Routes,
  useLocation,
  Navigate,
  useSearchParams
} from "react-router-dom";

import { registerSW } from 'virtual:pwa-register';

import PlanViewer from "./components/PlanViewer";
import PwaInstallPrompt from "./PwaInstallPrompt";
import CommunicationPortal from './components/CommunicationPortal';
import Home from "./components/Home";
import Signin from "./components/Signin";
import Dashboard from "./components/Dashboard";
import Navbar from "./components/Navbar";
import Signup from "./components/Signup";
import TaskForm from "./components/TaskForm";
import SinglePost from "./components/SinglePost";
import Publicprofile from "./components/Publicprofile";
import Popup from "./components/Popup";
import NotFound from "./components/NotFound";
import SyllabusExplorer from "./components/SyllabusExplorer";
import ForgetPassword from "./components/Forget_password";
import InternshipPortal from "./components/InternshipPortal";
import FinalBuy from "./components/FinalBuy";
import PaymentHistory from "./components/PaymentHistory";
import PaymentStatus from "./components/PaymentStatus";
import EnrollPage from "./components/Enrol";

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
      isCuTeTeam: false
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

      const tokenFromUrl =
        searchParams.get('token');

      const isNewUser =
        searchParams.get('new') === 'true';

      if (tokenFromUrl) {

        localStorage.setItem(
          "jwtoken",
          tokenFromUrl
        );

      }

      if (isNewUser) {

        setShowRolePopup(true);

      }

      if (tokenFromUrl || isNewUser) {

        const newParams =
          new URLSearchParams(searchParams);

        newParams.delete('token');

        newParams.delete('new');

        setSearchParams(newParams, {
          replace: true
        });

      }

      const activeToken =
        localStorage.getItem("jwtoken");

      if (activeToken) {

        try {

          const res = await fetch(
            `${import.meta.env.VITE_API}profile`,
            {
              method: "GET",
              headers: {
                "Content-Type":
                  "application/json",
                "Authorization":
                  `Bearer ${activeToken}`
              }
            }
          );

          const data = await res.json();

          if (res.ok && data.user) {

            localStorage.setItem(
              "Username",
              data.user.username
            );

            localStorage.setItem(
              "userId",
              data.user._id
            );

            localStorage.setItem(
              "Photo",
              data.user.photo || ""
            );

            localStorage.setItem(
              "Name",
              data.user.name || ""
            );

            setUserData({
              _id: data.user._id,
              Photo:
                data.user.photo?.toString() || "",
              Name:
                data.user.name?.toString() || "",
              Role:
                data.user.role?.toString() || "",
              isAdmin:
                data.user.isAdmin || false,
              isVerifiedStaff:
                data.user.isVerifiedStaff || false,
              staffApprovalRequested:
                data.user.staffApprovalRequested || false,
              isVerifiedParent:
                data.user.isVerifiedParent || false,
              parentVerificationRequested:
                data.user.parentVerificationRequested || false,
              dashboardLayout:
                data.user.dashboardLayout || [],
              isCuTeTeam:
                data.user.isCuTeTeam || false,
            });

            setIsServerVerified(true);

          }

        } catch (error) {

          console.error(
            "Network error fetching user profile:",
            error
          );

        } finally {

          setIsAuthLoading(false);

        }

      } else {

        setIsAuthLoading(false);

      }

    };

    initializeAuth();

  }, [searchParams, setSearchParams]);

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
              path="/edit-syllabus/:username"
              element={
                <SyllabusExplorer
                  userData={userData}
                />
              }
            />

            {/* PAYMENT SUCCESS */}
            <Route
              path="/payment-status" // Note: PhonePe is currently configured to redirect to this URL
              element={<PaymentStatus />}
            />
            {/* FINAL BUY */}
            <Route
              path="/finalBuy"
              element={<FinalBuy />}
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

            {/* NOT FOUND */}
            <Route
              path="*"
              element={<NotFound />}
            />

          </Routes>

          {isAuth && (
            <CommunicationPortal />
          )}

        </>
        

      )}

    </div>

  );

}

export default App;