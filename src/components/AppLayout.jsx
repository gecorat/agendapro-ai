import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Calendar, Users, LayoutDashboard, Settings, LogOut, CalendarClock, Menu, X, Shield, MessageCircle, History, ClipboardList, BarChart3, Star, BookOpen, UserCircle, CreditCard } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
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

  const navGroups = [
    {
      title: "Principal",
      items: [
        { label: "Panel", path: "/", icon: LayoutDashboard },
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
        { label: "Probar el bot", path: "/bot", icon: MessageCircle },
        { label: "Guía", path: "/welcome-guide", icon: BookOpen },
        { label: "Mi perfil", path: "/profile-editor", icon: UserCircle },
        { label: "Planes", path: "/upgrade-plan", icon: CreditCard },
      ],
    },
  ];
  if (user?.role === "admin") {
    navGroups.push({ title: "Sistema", items: [{ label: "Administración", path: "/admin", icon: Shield }] });
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <p className="font-heading font-semibold text-sm leading-tight">AgendaPro</p>
          <p className="text-xs text-muted-foreground">
            {settings?.practice_name || "Recepcionista virtual"}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1 text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">{group.title}</p>
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
                        ? "bg-primary text-primary-foreground"
                        : item.path === "/bot"
                        ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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

      <div className="border-t border-border p-3">
        {user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-card">{SidebarContent}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card">{SidebarContent}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-heading font-semibold text-sm">AgendaPro</span>
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