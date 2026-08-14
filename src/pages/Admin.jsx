import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, UserPlus, Ticket, Plug, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminInvitations from "@/components/admin/AdminInvitations";
import AdminConnections from "@/components/admin/AdminConnections";

export default function Admin() {
  return (
    <div className="px-3 py-3 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
            <Shield className="w-6 h-6" /> Administración
          </h1>
          <p className="text-sm text-muted-foreground">Gestión de profesionales, invitaciones y conexiones de plataforma</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open("/landing-preview", "_blank")}>
          <ExternalLink className="w-4 h-4 mr-1" /> Ver landing
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="users"><UserPlus className="w-4 h-4 mr-1" /> Usuarios</TabsTrigger>
          <TabsTrigger value="invitations"><Ticket className="w-4 h-4 mr-1" /> Invitaciones</TabsTrigger>
          <TabsTrigger value="connections"><Plug className="w-4 h-4 mr-1" /> Conexiones</TabsTrigger>
        </TabsList>

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