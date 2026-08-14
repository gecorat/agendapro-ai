import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import AppLayout from "@/components/AppLayout";
import Home from "@/pages/Home";
import PublicReview from "@/pages/PublicReview";
import Agenda from "@/pages/Agenda";
import Patients from "@/pages/Patients";
import Settings from "@/pages/Settings";
import PublicBooking from "@/pages/PublicBooking";
import Admin from "@/pages/Admin";
import Landing from "@/pages/Landing";
import BotPreview from "@/pages/BotPreview";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ServiceManager from "@/pages/ServiceManager";
import Analytics from "@/pages/Analytics";
import WelcomeGuide from "@/pages/WelcomeGuide";
import PatientList from "@/pages/PatientList";
import ProfileEditor from "@/pages/ProfileEditor";
import UpgradePlan from "@/pages/UpgradePlan";
import AvailabilitySettings from "@/pages/AvailabilitySettings";
import AppointmentHistory from "@/pages/AppointmentHistory";
import ReviewsManager from "@/pages/ReviewsManager";
import ConfirmAppointment from "@/pages/ConfirmAppointment";
import CancelAppointment from "@/pages/CancelAppointment";
import RescheduleAppointment from "@/pages/RescheduleAppointment";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();
  const location = useLocation();

  const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
  if (location.pathname.startsWith("/u/") || location.pathname.startsWith("/r/") || location.pathname === "/landing-preview" || PUBLIC_PATHS.includes(location.pathname)) return null;

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not authenticated → show public landing
  if (!isAuthenticated) {
    return <Landing />;
  }

  // Handle authentication errors for registered users
  if (authError && authError.type === "user_not_registered") {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/pacientes" element={<Patients />} />
        <Route path="/configuracion" element={<Settings />} />
        <Route path="/bot" element={<BotPreview />} />
        <Route path="/service-manager" element={<ServiceManager />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/welcome-guide" element={<WelcomeGuide />} />
        <Route path="/patient-list" element={<PatientList />} />
        <Route path="/profile-editor" element={<ProfileEditor />} />
        <Route path="/upgrade-plan" element={<UpgradePlan />} />
        <Route path="/availability-settings" element={<AvailabilitySettings />} />
        <Route path="/appointment-history" element={<AppointmentHistory />} />
        <Route path="/reviews-manager" element={<ReviewsManager />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/u/:handle" element={<PublicBooking />} />
            <Route path="/r/:id" element={<PublicReview />} />
            <Route path="/c/:token" element={<ConfirmAppointment />} />
            <Route path="/x/:token" element={<CancelAppointment />} />
            <Route path="/reschedule/:token" element={<RescheduleAppointment />} />
            <Route path="/landing-preview" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App