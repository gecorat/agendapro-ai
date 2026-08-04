# PRD — Recepcionista virtual para profesionales de salud

## 1. Resumen

Producto SaaS dirigido a **un profesional independiente de salud** (odontólogo, psicólogo, etc.).
Resuelve tres problemas: ausencias a citas, tiempo perdido respondiendo WhatsApp para agendar, y pacientes que no vuelven.

El diferencial no es "otra agenda": es un **recepcionista virtual por WhatsApp** conectado a la agenda del profesional, con recordatorios automáticos, seguimiento posterior y un enlace público de reservas.

---

## 2. Público y mercado inicial

- Profesional independiente, un solo consultorio.
- Nicho inicial: odontólogos independientes.
- Validar con 10–15 entrevistas y conseguir 3–5 pilotos pagos antes de escalar.
- Más adelante: psicólogos y otras especialidades.

---

## 3. Planes y cobro

| Plan | Precio/mes | Citas/mes | Incluye |
|---|---|---|---|
| Base | USD 59 | hasta 100 | Agenda + reservas públicas + recordatorios WhatsApp y email + recurrencias + seguimientos |
| Pro | USD 79 | ilimitadas | Todo lo anterior, sin límite de citas |

- **14 días de prueba** sin tarjeta.
- La prueba incluye todas las funciones (plan Pro).
- Al terminar, el profesional elige plan e ingresa método de pago.
- Cambio de plan aplica desde el próximo ciclo (sin prorrateos).

### Qué cuenta como "cita"
- Toda cita creada o confirmada (incluye recurrentes).
- Cancelaciones con ≥24 hs de anticipación **no** consumen cupo.

### Límite de WhatsApp
- El plan Base cubre los recordatorios de las 100 citas.
- Sobre 100 citas: se avisa y se pausa la automatización de WhatsApp (no la creación de citas) hasta subir a Pro o reiniciar el ciclo.

---

## 4. Funciones del producto base

### 4.1 Acceso
- Login con email + contraseña.
- Login con Google.
- Ruta protegida para el panel.
- Onboarding guiado tras el registro.

### 4.2 Panel principal (Dashboard)
- Citas de hoy y próximas.
- Estados: confirmada, pendiente, cancelada, completada.
- Alertas de pacientes que no respondieron.
- Espacios libres del día.
- Indicador mensual: ausencias y citas recuperadas.

### 4.3 Agenda
- Vistas: diaria, semanal, mensual.
- Crear, editar, cancelar, marcar completada.
- Citas recurrentes: semanal, quincenal, mensual.
  - Editar "solo esta cita" o "toda la serie".
- Horarios laborales, descansos, feriados, bloqueos personales.
- Duración y margen entre citas por servicio.
- Sincronización bidireccional con Google Calendar.

### 4.4 Pacientes
- Nombre, teléfono, email, datos administrativos.
- Historial de citas, cancelaciones y ausencias.
- Preferencia de contacto (WhatsApp / email).
- Notas internas (no historia clínica).
- Próximo seguimiento recomendado.
- Consentimiento para recibir mensajes.

### 4.5 WhatsApp automatizado
- Asistente con identidad clara ("asistente virtual del consultorio", no persona real).
- Consulta disponibilidad real y ofrece 2–3 horarios.
- Reserva, confirma, cancela y reprograma.
- Respeta duración del servicio, descansos y horarios.
- Recordatorios configurables (ej. 24 hs y 2 hs antes).
- Derivación a humano cuando no entiende o es tema clínico.
- Mensajes mínimos por privacidad: sin diagnósticos ni datos sensibles.

### 4.6 Recordatorios por email
- Email más completo: dirección, instrucciones, enlace para confirmar/reprogramar/cancelar.
- Respaldo si WhatsApp falla o el paciente no lee.
- El profesional elige por paciente qué canales activar.

### 4.7 Reserva pública
- Enlace propio por profesional.
- El paciente: elige servicio → elige horario → completa datos → confirma.
- Sin crear cuenta.
- Confirmación + enlace privado y temporal para gestionar la cita (reprogramar/cancelar).

### 4.8 Seguimientos
- Tras cita completada: preguntar si reserva el próximo turno.
- Recordatorios de controles periódicos (ej. limpieza cada 6 meses).
- Reactivación de pacientes inactivos (configurable por servicio).

### 4.9 Configuración
- Datos del profesional y del consultorio.
- Servicios: nombre, duración, margen, color.
- Horarios y feriados.
- Conexión de Google Calendar.
- Conexión y configuración de WhatsApp (onboarding guiado o asistido).
- Plantillas de mensajes y emails.
- Gestión de plan y método de pago.

---

## 5. Fuera de la primera versión

- Historia clínica completa.
- Facturación y seguros.
- Recetas y documentos clínicos.
- Videoconsultas.
- App móvil nativa.
- IA respondiendo preguntas médicas.
- Múltiples sucursales / equipos.
- Permisos para recepcionistas.
- Campañas masivas de marketing.
- Lista de espera automática y depósitos (candidatos a fase 2).

---

## 6. Entidades sugeridas (modelo de datos)

- **Service** — servicios ofrecidos (nombre, duración, margen, color, seguimiento sugerido).
- **Patient** — datos administrativos, preferencia de contacto, consentimiento, notas.
- **Appointment** — cita (paciente, servicio, fecha/hora, estado, recurrencia, origen).
- **RecurringRule** — regla de recurrencia (frecuencia, hasta cuándo, excepciones).
- **Availability** — horarios laborales, descansos, feriados, bloqueos.
- **ReminderLog** — registro de recordatorios enviados (canal, estado, fecha).
- **Conversation** — conversaciones de WhatsApp (paciente, mensajes, estado).
- **Settings** — configuración del profesional (datos, plantillas, integraciones, plan).
- **Subscription** — plan, estado, ciclo, método de pago, límites.

---

## 7. Integraciones

- **Google Calendar** — sincronización bidireccional de citas.
- **WhatsApp Business Platform** — mensajería y plantillas de utilidad.
- **Email** — recordatorios y confirmaciones.
- **Pagos** — suscripción recurrente (definir proveedor: Stripe / MercadoPago según mercado).

---

## 8. Riesgos y mitigaciones

- **Competencia fuerte** (Calendly, Acuity, SimplyBook.me): diferenciarse con WhatsApp + español + foco en salud + seguimiento.
- **Costo variable de WhatsApp**: límites por plan y cobro atado al uso.
- **Configuración de WhatsApp con Meta**: onboarding guiado/asistido como parte del servicio.
- **Privacidad y cumplimiento**: mensajes mínimos, consentimiento explícito, no almacenar datos clínicos sensibles en la primera versión.

---

## 9. Validación antes de construir

1. Entrevistar 10–15 profesionales.
2. Consegir 3–5 pilotos pagos.
3. Medir: ausencias antes/después, horas ahorradas en WhatsApp, citas recuperadas.

---

## 10. Próximos pasos

1. Confirmar este PRD con el profesional.
2. Modelar entidades y crearlas.
3. Diseñar pantallas (login, dashboard, agenda, pacientes, reserva pública, configuración).
4. Conectar Google Calendar.
5. Conectar WhatsApp Business.
6. Integrar cobros.
7. Onboarding y prueba de 14 días.