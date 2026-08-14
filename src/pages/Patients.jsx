import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Users, Phone, Mail, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import PatientForm from "@/components/PatientForm";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { preset } = usePracticeSettings();
  const patientLabelLower = preset.patientLabel.toLowerCase();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [pats, appts] = await Promise.all([
        base44.entities.Patient.filter({}),
        base44.entities.Appointment.filter({}),
      ]);
      setPatients(pats || []);
      setAppointments(appts || []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter((p) => {
      const name = `${p.first_name} ${p.last_name || ""}`.toLowerCase();
      return name.includes(q) || (p.phone || "").includes(q) || (p.email || "").toLowerCase().includes(q);
    });
  }, [patients, search]);

  function apptCount(patientId) {
    return appointments.filter((a) => a.patient_id === patientId).length;
  }

  async function handleDelete(p) {
    if (!confirm(`¿Eliminar a ${p.first_name} ${p.last_name || ""}?`)) return;
    await base44.entities.Patient.delete(p.id);
    load();
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setFormOpen(true);
  }

  return (
    <div className="px-3 py-3 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold">{preset.patientLabel}</h1>
          <p className="text-muted-foreground text-sm">{patients.length} {patientLabelLower}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" />
          Nuevo {patientLabelLower.slice(0, -1)}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {search ? "Sin resultados" : `Todavía no hay ${patientLabelLower}`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold truncate">
                    {p.first_name} {p.last_name || ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {apptCount(p.id)} cita(s)
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {p.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    {p.phone}
                  </p>
                )}
                {p.email && (
                  <p className="flex items-center gap-2 text-muted-foreground truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {p.email}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        patient={editing}
      />
    </div>
  );
}