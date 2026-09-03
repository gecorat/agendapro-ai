import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, UserPlus, Ticket, Plug, ExternalLink, Loader2, ShieldAlert, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminInvitations from "@/components/admin/AdminInvitations";
import AdminConnections from "@/components/admin/AdminConnections";
import AdminStats from "@/components/admin/AdminStats";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setUser).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Antes esta pantalla no verificaba nada: un usuario sin rol de administrador podía
  // entrar, tocar todo, y los guardados se rechazaban en el servidor sin ningún aviso —
  // parecía que "funcionaba" pero nunca se guardaba nada. Ahora se lo decimos de una.
  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-3">
        <ShieldAlert className="w-10 h-10 text-muted-foreground" />
        <div>
          <p className="font-heading font-semibold">No tenés permisos de administrador</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Esta sección es solo para la cuenta de administrador de la plataforma. Ingresá con esa cuenta para acceder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
            <Shield className="w-6 h-6" /> Administración
          </h1>
          <p className="text-sm text-muted-foreground">Estadísticas, profesionales, invitaciones y conexiones de plataforma</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open("/landing-preview", "_blank")}>
          <ExternalLink className="w-4 h-4 mr-1" /> Ver landing
        </Button>
      </div>

      <Tabs defaultValue="stats">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="stats"><BarChart3 className="w-4 h-4 mr-1" /> Estadísticas</TabsTrigger>
          <TabsTrigger value="users"><UserPlus className="w-4 h-4 mr-1" /> Usuarios</TabsTrigger>
          <TabsTrigger value="invitations"><Ticket className="w-4 h-4 mr-1" /> Invitaciones</TabsTrigger>
          <TabsTrigger value="connections"><Plug className="w-4 h-4 mr-1" /> Conexiones</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <AdminStats />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <AdminUsers />
        </TabsContent>
        <TabsContent value="invitations" className="mt-4">
          <AdminInvitations />
        </TabsContent>
        <TabsContent value="connections" className="mt-4">
          <AdminConnections />
        </TabsContent>
      </Tabs>
    </div>
  );
}
