import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Users, Phone, Mail, Pencil, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PatientForm from "@/components/PatientForm";
import PatientDetail from "@/components/PatientDetail";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";

const AVATAR_HUES = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700"];

function avatarStyle(name) {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_HUES[sum % AVATAR_HUES.length];
}

function initials(first, last) {
  return `${(first || "?")[0]}${(last || "")[0] || ""}`.toUpperCase();
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPatient, setDetailPatient] = useState(null);
  const { preset } = usePracticeSettings();
  const patientLabelLower = preset.patientLabel.toLowerCase();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      // Antes esto llamaba Patient.filter({}) directo, que dependia de reglas de acceso
      // que no contemplan a un profesional invitado (su professional_id guardado es el
      // del DUEÑO, nunca coincide con su propio usuario) — le hubiera mostrado todo
      // vacío. Esta función resuelve bien quién sos y te devuelve SOLO lo que te toca ver.
      const [patsRes, apptsRes] = await Promise.all([
        base44.functions.invoke("getScopedPatients", {}),
        base44.functions.invoke("getScopedAppointments", {}),
      ]);
      setPatients(patsRes?.data?.patients || []);
      setAppointments(apptsRes?.data?.appointments || []);
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

  function openDetail(p) {
    setDetailPatient(p);
    setDetailOpen(true);
  }

  function handleAppointmentUpdate(updated) {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
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
          <h1 className="text-2xl font-heading font-semibold tracking-tight">{preset.patientLabel}</h1>
          <p className="text-muted-foreground text-sm">{patients.length} {patientLabelLower}</p>
        </div>
        <Button onClick={openNew} className="shadow-sm">
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
          className="pl-10 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">
            {search ? "Sin resultados" : `Todavía no hay ${patientLabelLower}`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const fullName = `${p.first_name} ${p.last_name || ""}`.trim();
            return (
              <div key={p.id} className="bg-card rounded-2xl border border-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${avatarStyle(fullName || "?")}`}>
                    {initials(p.first_name, p.last_name)}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="font-heading font-semibold truncate">{fullName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {apptCount(p.id)} cita{apptCount(p.id) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-0.5 shrink-0 -mr-1.5 -mt-1">
                    <button onClick={() => openDetail(p)} title="Ver historial" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      <FileText className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(p)} title="Editar" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {(p.phone || p.email) && (
                  <div className="mt-3 pl-[52px] space-y-1 text-sm">
                    {p.phone && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
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
                )}
              </div>
            );
          })}
        </div>
      )}

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        patient={editing}
      />

      <PatientDetail
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        patient={detailPatient}
        appointments={appointments}
        onUpdateAppointment={handleAppointmentUpdate}
      />
    </div>
  );
}
