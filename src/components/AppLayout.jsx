import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Calendar, Users, LayoutDashboard, Settings, LogOut, Menu, Shield, MessageCircle, History, BarChart3, Star, BookOpen, UserCircle, CreditCard, Sparkles, Palette } from "lucide-react";
import { LOGO_ICON } from "@/assets/logo";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import Onboarding from "@/pages/Onboarding";
import TrialBanner from "@/components/TrialBanner";
import NotificationsBell from "@/components/NotificationsBell";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { settings, loading: loadingSettings, preset, reload } = usePracticeSettings();

  useEffect(() => {
    base44.auth.me().then((u) => { setUser(u); setUserLoading(false); }).catch(() => setUserLoading(false));
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout();
    navigate("/login");
  };

  if (loadingSettings || userLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings && user?.role !== "admin") {
    return <Onboarding onConfigured={reload} />;
  }

  const isActive = (path) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path));

  const planStatus = getPlanStatus(settings);
  const hasFullAssistant = planStatus.canUseWhatsApp;

  const navGroups = [
    {
      title: "Principal",
      items: [
        { label: "Panel", path: "/", icon: LayoutDashboard },
        { label: "Chats", path: "/asistente", icon: MessageCircle },
        { label: "Agenda", path: "/agenda", icon: Calendar },
        { label: "Citas pasadas", path: "/appointment-history", icon: History },
      ],
    },
    {
      title: "Gestión",
      items: [
        { label: preset.patientLabel, path: "/pacientes", icon: Users },
        { label: "Reportes", path: "/analytics", icon: BarChart3 },
        { label: "Reseñas", path: "/reviews-manager", icon: Star },
        { label: "Ajustes", path: "/configuracion", icon: Settings },
      ],
    },
    {
      title: "Crecimiento",
      items: [
        ...(!hasFullAssistant ? [{ label: "Probar el bot", path: "/bot", icon: Sparkles }] : []),
        { label: "Guía", path: "/welcome-guide", icon: BookOpen },
        { label: "Mi perfil", path: "/profile-editor", icon: UserCircle },
        { label: "Página pública", path: "/public-page-editor", icon: Palette },
        { label: "Planes", path: "/upgrade-plan", icon: CreditCard },
      ],
    },
  ];
  if (user?.role === "admin") {
    navGroups.push({ title: "Sistema", items: [{ label: "Administración", path: "/admin", icon: Shield }] });
  }

  const SidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0B1130] via-[#141E4D] to-[#1B2A66] text-white">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center overflow-hidden">
          <img src={LOGO_ICON} alt="Kame Agenda" className="w-6 h-6 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-heading font-semibold text-sm leading-tight text-white">Kame Agenda</p>
          <p className="text-xs text-blue-200/60 truncate">
            {settings?.practice_name || "Recepcionista virtual"}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1 text-xs font-medium text-blue-200/40 uppercase tracking-wide">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-white text-[#141E4D] shadow-sm"
                        : item.path === "/asistente"
                        ? "bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                        : item.path === "/bot"
                        ? "bg-violet-400/10 text-violet-300 hover:bg-violet-400/20"
                        : "text-blue-100/70 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        {user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate text-white">{user.full_name || user.email}</p>
            <p className="text-xs text-blue-200/50 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100/70 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    // overflow-hidden acá (no en html/body global, que rompería el scroll normal de la
    // página pública /u/:handle) fuerza a que TODO el scroll de las pantallas de la app
    // pase por adentro (el <main> de abajo, o los paneles internos de cada pantalla) — el
    // documento en sí nunca puede scrollear solo, que era la causa real del espacio en
    // blanco fantasma reportado varias veces.
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0">{SidebarContent}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 shadow-xl">{SidebarContent}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-3 py-2.5 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-heading font-semibold text-sm">Kame Agenda</span>
          <div className="flex items-center">
            <NotificationsBell user={user} />
            <Link to="/profile-editor" className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
              <UserCircle className="w-6 h-6" />
            </Link>
          </div>
        </header>

        <header className="hidden md:flex items-center justify-end h-14 px-6 border-b border-border bg-card">
          <NotificationsBell user={user} />
        </header>

        <main className="flex-1 overflow-y-auto">
          <TrialBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}