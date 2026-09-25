import { useState, useMemo } from "react";
import {
  Building2, Wrench, Users, LogOut, LayoutDashboard, Calendar, ClipboardList,
  AlertTriangle, CheckCircle2, Clock, MapPin, MessageSquare, Bell, Plus, X,
  ChevronRight, ArrowLeft, Check, QrCode, Wifi, WifiOff, RefreshCw, Phone,
  Mail, Zap, Activity, ChevronDown, Info, Shield, Truck, Hotel, Factory,
  Heart, ArrowRight, Send, FileText, MoreHorizontal, Navigation, Copy,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "operator" | "technician" | "client";
type JobStatus = "scheduled" | "in_progress" | "completed" | "overdue";
type EmergencyType = "trapped" | "mechanical" | "power" | "fire" | "flood";
type BuildingType = "residential" | "hospital" | "industrial" | "hotel" | "mall" | "office";

interface Part {
  name: string;
  brand: string;
  isOriginal: boolean;
  replacedDate: string;
}

interface LogEntry {
  id: string;
  date: string;
  type: "maintenance" | "repair" | "emergency" | "inspection" | "first_visit";
  technicianName: string;
  description: string;
  parts: Part[];
}

interface Elevator {
  id: string;
  qrCode: string;
  buildingId: string;
  brand: string;
  model: string;
  installYear: number;
  floors: number;
  status: "operational" | "warning" | "critical" | "offline";
  failureRate: number;
  lastMaintenance: string;
  logbook: LogEntry[];
}

interface Building {
  id: string;
  name: string;
  address: string;
  type: BuildingType;
  clientId: string;
  mapX: number;
  mapY: number;
  elevators: Elevator[];
  adminContact: string;
  adminEmail: string;
}

interface TechnicianData {
  id: string;
  name: string;
  avatar: string;
  zone: string;
  phone: string;
  specialty: EmergencyType[];
  mapX: number;
  mapY: number;
  status: "available" | "on_job" | "offline";
}

interface Job {
  id: string;
  elevatorId: string;
  buildingId: string;
  buildingName: string;
  elevatorLabel: string;
  address: string;
  type: "maintenance" | "repair" | "emergency" | "inspection" | "first_visit";
  scheduledDate: string;
  scheduledTime: string;
  technicianId: string;
  technicianName: string;
  status: JobStatus;
  priority: "low" | "medium" | "high" | "critical";
  notes: string;
  checklist: { item: string; done: boolean }[];
}

interface Emergency {
  id: string;
  type: EmergencyType;
  buildingId: string;
  buildingName: string;
  elevatorId: string;
  reportedAt: string;
  description: string;
  status: "active" | "responding" | "resolved";
  assignedTechs: string[];
}

interface Message {
  id: string;
  from: string;
  fromRole: Role | "admin";
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
  thread: { from: string; body: string; sentAt: string }[];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const TECHNICIANS: TechnicianData[] = [
  { id: "T01", name: "Marcus Delgado", avatar: "MD", zone: "North District", phone: "+56 9 5511 4201", specialty: ["trapped", "mechanical"], mapX: 120, mapY: 90, status: "on_job" },
  { id: "T02", name: "Priya Nair", avatar: "PN", zone: "Central", phone: "+56 9 5511 4202", specialty: ["power", "mechanical"], mapX: 300, mapY: 180, status: "available" },
  { id: "T03", name: "James Kowalski", avatar: "JK", zone: "East Side", phone: "+56 9 5511 4203", specialty: ["fire", "trapped"], mapX: 460, mapY: 110, status: "on_job" },
  { id: "T04", name: "Sonia Ferreira", avatar: "SF", zone: "South District", phone: "+56 9 5511 4204", specialty: ["mechanical", "flood"], mapX: 280, mapY: 290, status: "available" },
  { id: "T05", name: "Omar Benali", avatar: "OB", zone: "West Side", phone: "+56 9 5511 4205", specialty: ["power", "fire"], mapX: 80, mapY: 220, status: "available" },
];

const BUILDINGS: Building[] = [
  {
    id: "B01", name: "Northgate Tower", address: "Av. Providencia 1240, Santiago",
    type: "residential", clientId: "C01", mapX: 115, mapY: 85,
    adminContact: "Elaine Cho", adminEmail: "elaine.cho@northgate.cl",
    elevators: [
      {
        id: "ELV-01A", qrCode: "LO-B01-01A", buildingId: "B01", brand: "Schindler", model: "3300", installYear: 2015, floors: 18, status: "operational", failureRate: 4.2, lastMaintenance: "2026-06-25",
        logbook: [
          { id: "L01", date: "2026-06-25", type: "maintenance", technicianName: "Priya Nair", description: "Quarterly inspection. All systems nominal. Door sensors calibrated.", parts: [] },
          { id: "L02", date: "2026-03-10", type: "repair", technicianName: "Marcus Delgado", description: "Replaced worn brake pads.", parts: [{ name: "Brake pad set", brand: "Schindler OEM", isOriginal: true, replacedDate: "2026-03-10" }] },
          { id: "L03", date: "2025-11-04", type: "repair", technicianName: "James Kowalski", description: "Encoder board replaced after intermittent fault.", parts: [{ name: "Encoder board", brand: "GenLift Pro", isOriginal: false, replacedDate: "2025-11-04" }] },
        ],
      },
      {
        id: "ELV-01B", qrCode: "LO-B01-01B", buildingId: "B01", brand: "Schindler", model: "3300", installYear: 2015, floors: 18, status: "warning", failureRate: 11.8, lastMaintenance: "2026-05-14",
        logbook: [
          { id: "L04", date: "2026-05-14", type: "maintenance", technicianName: "Sonia Ferreira", description: "Door timing adjustment. Minor oil leak detected in guide rail — monitored.", parts: [] },
          { id: "L05", date: "2026-02-20", type: "repair", technicianName: "Marcus Delgado", description: "Oil seal replacement.", parts: [{ name: "Guide rail oil seal", brand: "TechLift NG", isOriginal: false, replacedDate: "2026-02-20" }] },
        ],
      },
    ],
  },
  {
    id: "B02", name: "Lakeside Medical Center", address: "Av. Salvador 1800, Providencia",
    type: "hospital", clientId: "C02", mapX: 200, mapY: 255,
    adminContact: "Dr. Rubén Soto", adminEmail: "admin@lakemedical.cl",
    elevators: [
      { id: "ELV-02A", qrCode: "LO-B02-02A", buildingId: "B02", brand: "Otis", model: "Gen2", installYear: 2019, floors: 12, status: "operational", failureRate: 1.9, lastMaintenance: "2026-06-20", logbook: [{ id: "L06", date: "2026-06-20", type: "maintenance", technicianName: "Priya Nair", description: "Monthly inspection. All hospital-grade standards met. Emergency phone tested.", parts: [] }] },
      { id: "ELV-02B", qrCode: "LO-B02-02B", buildingId: "B02", brand: "Otis", model: "Gen2", installYear: 2019, floors: 12, status: "operational", failureRate: 2.3, lastMaintenance: "2026-06-20", logbook: [{ id: "L07", date: "2026-06-20", type: "maintenance", technicianName: "Priya Nair", description: "Monthly inspection complete.", parts: [] }] },
      { id: "ELV-02C", qrCode: "LO-B02-02C", buildingId: "B02", brand: "Otis", model: "Gen2", installYear: 2020, floors: 12, status: "critical", failureRate: 22.1, lastMaintenance: "2026-06-01", logbook: [{ id: "L08", date: "2026-06-01", type: "emergency", technicianName: "Marcus Delgado", description: "Person trapped on floor 7 — rescued in 18 min. Overspeed governor triggered.", parts: [{ name: "Overspeed governor", brand: "Otis OEM", isOriginal: true, replacedDate: "2026-06-01" }] }] },
    ],
  },
  {
    id: "B03", name: "Meridian Business Park", address: "Av. Apoquindo 3500, Las Condes",
    type: "office", clientId: "C01", mapX: 450, mapY: 105,
    adminContact: "Andrea Vásquez", adminEmail: "andrea.v@meridian.cl",
    elevators: [
      { id: "ELV-03A", qrCode: "LO-B03-03A", buildingId: "B03", brand: "KONE", model: "MonoSpace", installYear: 2018, floors: 22, status: "operational", failureRate: 3.1, lastMaintenance: "2026-06-15", logbook: [] },
      { id: "ELV-03B", qrCode: "LO-B03-03B", buildingId: "B03", brand: "KONE", model: "MonoSpace", installYear: 2018, floors: 22, status: "operational", failureRate: 5.4, lastMaintenance: "2026-06-15", logbook: [] },
    ],
  },
  {
    id: "B04", name: "Grand Hotel Central", address: "Av. Libertador 900, Santiago Centro",
    type: "hotel", clientId: "C03", mapX: 310, mapY: 195,
    adminContact: "Carlos Muñoz", adminEmail: "cmuñoz@grandhotel.cl",
    elevators: [
      { id: "ELV-04A", qrCode: "LO-B04-04A", buildingId: "B04", brand: "ThyssenKrupp", model: "Evolution 200", installYear: 2021, floors: 30, status: "operational", failureRate: 2.7, lastMaintenance: "2026-06-28", logbook: [] },
      { id: "ELV-04B", qrCode: "LO-B04-04B", buildingId: "B04", brand: "ThyssenKrupp", model: "Evolution 200", installYear: 2021, floors: 30, status: "warning", failureRate: 8.3, lastMaintenance: "2026-06-10", logbook: [] },
      { id: "ELV-04C", qrCode: "LO-B04-04C", buildingId: "B04", brand: "ThyssenKrupp", model: "Evolution 200", installYear: 2012, floors: 30, status: "warning", failureRate: 14.6, lastMaintenance: "2026-05-22", logbook: [{ id: "L09", date: "2026-05-22", type: "repair", technicianName: "Sonia Ferreira", description: "Door clutch replaced with 3rd party part — original discontinued.", parts: [{ name: "Door clutch assembly", brand: "EuroLift Parts", isOriginal: false, replacedDate: "2026-05-22" }] }] },
    ],
  },
  {
    id: "B05", name: "Archway Residences", address: "Av. Vitacura 475, Vitacura",
    type: "residential", clientId: "C02", mapX: 90, mapY: 215,
    adminContact: "Patricia Rojas", adminEmail: "admin@archway.cl",
    elevators: [
      { id: "ELV-05A", qrCode: "LO-B05-05A", buildingId: "B05", brand: "Mitsubishi", model: "Elan", installYear: 2016, floors: 14, status: "operational", failureRate: 6.0, lastMaintenance: "2026-06-18", logbook: [] },
    ],
  },
  {
    id: "B06", name: "Industrial Park Alfa", address: "Av. Vicuña Mackenna 7800, La Florida",
    type: "industrial", clientId: "C01", mapX: 490, mapY: 290,
    adminContact: "Roberto Arias", adminEmail: "rarias@alfa.cl",
    elevators: [
      { id: "ELV-06A", qrCode: "LO-B06-06A", buildingId: "B06", brand: "Fujitec", model: "GETII", installYear: 2011, floors: 6, status: "critical", failureRate: 28.4, lastMaintenance: "2026-06-22", logbook: [{ id: "L10", date: "2026-06-22", type: "repair", technicianName: "James Kowalski", description: "Hydraulic pump replaced. Piston showed severe wear — urgent modernization recommended.", parts: [{ name: "Hydraulic pump", brand: "HydroElev SRL", isOriginal: false, replacedDate: "2026-06-22" }, { name: "Control board", brand: "Fujitec OEM", isOriginal: true, replacedDate: "2026-06-22" }] }] },
    ],
  },
];

const INITIAL_JOBS: Job[] = [
  { id: "WO-2847", elevatorId: "ELV-01A", buildingId: "B01", buildingName: "Northgate Tower", elevatorLabel: "ELV-01A", address: "Av. Providencia 1240", type: "maintenance", scheduledDate: "2026-07-02", scheduledTime: "09:00", technicianId: "T01", technicianName: "Marcus Delgado", status: "scheduled", priority: "medium", notes: "Door sensors and brake pad check.", checklist: [{ item: "Inspect rope & sheave", done: false }, { item: "Test door sensors", done: false }, { item: "Check oil levels", done: false }, { item: "Emergency phone test", done: false }] },
  { id: "WO-2848", elevatorId: "ELV-02C", buildingId: "B02", buildingName: "Lakeside Medical Center", elevatorLabel: "ELV-02C", address: "Av. Salvador 1800", type: "repair", scheduledDate: "2026-07-01", scheduledTime: "14:30", technicianId: "T02", technicianName: "Priya Nair", status: "in_progress", priority: "critical", notes: "Follow-up on overspeed governor replacement.", checklist: [{ item: "Test overspeed governor", done: true }, { item: "Full travel test", done: true }, { item: "Load test 125%", done: false }, { item: "Sign off with building manager", done: false }] },
  { id: "WO-2846", elevatorId: "ELV-03A", buildingId: "B03", buildingName: "Meridian Business Park", elevatorLabel: "ELV-03A", address: "Av. Apoquindo 3500", type: "inspection", scheduledDate: "2026-06-27", scheduledTime: "10:00", technicianId: "T03", technicianName: "James Kowalski", status: "overdue", priority: "high", notes: "Annual safety cert. Certificate expired Jun 30.", checklist: [{ item: "Full mechanical inspection", done: false }, { item: "Load test 125%", done: false }, { item: "Safety circuit check", done: false }, { item: "Submit cert", done: false }] },
  { id: "WO-2849", elevatorId: "ELV-05A", buildingId: "B05", buildingName: "Archway Residences", elevatorLabel: "ELV-05A", address: "Av. Vitacura 475", type: "maintenance", scheduledDate: "2026-07-04", scheduledTime: "08:00", technicianId: "T04", technicianName: "Sonia Ferreira", status: "scheduled", priority: "low", notes: "Routine lubrication.", checklist: [{ item: "Grease guide rails", done: false }, { item: "Lubricate rope anchors", done: false }, { item: "Top off hydraulic fluid", done: false }] },
  { id: "WO-2850", elevatorId: "ELV-04A", buildingId: "B04", buildingName: "Grand Hotel Central", elevatorLabel: "ELV-04A", address: "Av. Libertador 900", type: "maintenance", scheduledDate: "2026-07-07", scheduledTime: "11:00", technicianId: "T01", technicianName: "Marcus Delgado", status: "scheduled", priority: "medium", notes: "Tenant reported slow door on floor 12.", checklist: [{ item: "Inspect door operator motor", done: false }, { item: "Adjust door timing", done: false }, { item: "Test all call buttons", done: false }] },
  { id: "WO-2845", elevatorId: "ELV-02A", buildingId: "B02", buildingName: "Lakeside Medical Center", elevatorLabel: "ELV-02A", address: "Av. Salvador 1800", type: "maintenance", scheduledDate: "2026-06-25", scheduledTime: "07:00", technicianId: "T02", technicianName: "Priya Nair", status: "completed", priority: "medium", notes: "All systems nominal.", checklist: [{ item: "Inspect rope & sheave", done: true }, { item: "Test door sensors", done: true }, { item: "Check oil levels", done: true }, { item: "Emergency phone test", done: true }] },
  { id: "WO-2851", elevatorId: "ELV-06A", buildingId: "B06", buildingName: "Industrial Park Alfa", elevatorLabel: "ELV-06A", address: "Av. Vicuña Mackenna 7800", type: "repair", scheduledDate: "2026-07-03", scheduledTime: "08:30", technicianId: "T03", technicianName: "James Kowalski", status: "scheduled", priority: "high", notes: "Modernization assessment. Hydraulic system critical condition.", checklist: [{ item: "Assess hydraulic system", done: false }, { item: "Document part conditions", done: false }, { item: "Prepare modernization report", done: false }] },
  { id: "WO-2852", elevatorId: "ELV-01B", buildingId: "B01", buildingName: "Northgate Tower", elevatorLabel: "ELV-01B", address: "Av. Providencia 1240", type: "maintenance", scheduledDate: "2026-07-09", scheduledTime: "10:00", technicianId: "T05", technicianName: "Omar Benali", status: "scheduled", priority: "medium", notes: "Oil leak monitoring follow-up.", checklist: [{ item: "Check oil seal condition", done: false }, { item: "Measure oil level", done: false }, { item: "Document findings", done: false }] },
];

const EMERGENCIES: Emergency[] = [
  { id: "EM-001", type: "trapped", buildingId: "B04", buildingName: "Grand Hotel Central", elevatorId: "ELV-04B", reportedAt: "2026-07-01T10:23:00", description: "2 guests trapped between floors 14–15. Elevator door not responding.", status: "responding", assignedTechs: ["T04", "T02"] },
  { id: "EM-002", type: "mechanical", buildingId: "B06", buildingName: "Industrial Park Alfa", elevatorId: "ELV-06A", reportedAt: "2026-07-01T08:10:00", description: "Elevator not moving. Control panel shows error E-42 (brake fault).", status: "active", assignedTechs: [] },
];

const MESSAGES: Message[] = [
  { id: "M01", from: "Priya Nair", fromRole: "technician", to: "operator", subject: "ELV-02C status update", body: "Load test completed successfully. Ready for building manager sign-off at 17:00.", sentAt: "2026-07-01T14:45:00", read: false, thread: [{ from: "operator", body: "Thanks, I'll notify Dr. Soto.", sentAt: "2026-07-01T14:52:00" }] },
  { id: "M02", from: "Andrea Vásquez", fromRole: "admin", to: "operator", subject: "Annual cert — urgent", body: "We have an audit scheduled for July 5th. The annual cert for ELV-03A must be complete by then.", sentAt: "2026-06-30T09:00:00", read: true, thread: [] },
  { id: "M03", from: "Marcus Delgado", fromRole: "technician", to: "operator", subject: "ELV-04C door issue worsening", body: "During today's check I noticed the door clutch is misaligned again. Might need a second replacement soon. The EuroLift part quality is poor.", sentAt: "2026-07-01T11:30:00", read: false, thread: [] },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<Job["type"], string> = {
  maintenance: "Mantención", repair: "Reparación", emergency: "Emergencia",
  inspection: "Inspección", first_visit: "Primera Visita",
};

const EMERGENCY_LABELS: Record<EmergencyType, string> = {
  trapped: "Persona Atrapada", mechanical: "Falla Mecánica",
  power: "Corte de Energía", fire: "Incendio", flood: "Inundación",
};

const EMERGENCY_COLORS: Record<EmergencyType, string> = {
  trapped: "bg-red-600", mechanical: "bg-orange-500",
  power: "bg-yellow-500", fire: "bg-rose-700", flood: "bg-blue-600",
};

const BUILDING_TYPE_ICONS: Record<BuildingType, React.ReactNode> = {
  residential: <Building2 size={13} />, hospital: <Heart size={13} />,
  industrial: <Factory size={13} />, hotel: <Hotel size={13} />,
  mall: <Truck size={13} />, office: <Building2 size={13} />,
};

const BUILDING_TYPE_COLORS: Record<BuildingType, string> = {
  residential: "#3B82F6", hospital: "#EF4444", industrial: "#F59E0B",
  hotel: "#8B5CF6", mall: "#06B6D4", office: "#10B981",
};

const STATUS_ELV: Record<Elevator["status"], { label: string; color: string; dot: string }> = {
  operational: { label: "Operacional", color: "text-green-700", dot: "bg-green-500" },
  warning: { label: "Advertencia", color: "text-amber-700", dot: "bg-amber-500" },
  critical: { label: "Crítico", color: "text-red-700", dot: "bg-red-500" },
  offline: { label: "Fuera de línea", color: "text-slate-500", dot: "bg-slate-400" },
};

const PRIORITY_CFG = {
  low: { label: "Baja", color: "text-slate-500" },
  medium: { label: "Media", color: "text-amber-600" },
  high: { label: "Alta", color: "text-orange-600" },
  critical: { label: "Crítica", color: "text-red-600" },
};

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: JobStatus }) {
  const cfg: Record<JobStatus, { label: string; cls: string }> = {
    scheduled: { label: "Programado", cls: "text-blue-700 bg-blue-50" },
    in_progress: { label: "En curso", cls: "text-amber-700 bg-amber-50" },
    completed: { label: "Completado", cls: "text-green-700 bg-green-50" },
    overdue: { label: "Vencido", cls: "text-red-700 bg-red-50" },
  };
  const c = cfg[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${c.cls}`}>{c.label}</span>;
}

// ─── Simulated QR SVG ─────────────────────────────────────────────────────────

function QRSvg({ code }: { code: string }) {
  const pattern = code.split("").map((c) => c.charCodeAt(0) % 2 === 0);
  const cells = 9;
  return (
    <svg viewBox="0 0 90 90" width="90" height="90" style={{ imageRendering: "pixelated" }}>
      <rect width="90" height="90" fill="white" />
      {Array.from({ length: cells * cells }).map((_, i) => {
        const row = Math.floor(i / cells), col = i % cells;
        const isCorner = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3);
        const filled = isCorner || pattern[i % pattern.length];
        return filled ? <rect key={i} x={col * 10} y={row * 10} width="10" height="10" fill="#0D1B2A" /> : null;
      })}
    </svg>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

const LOGIN_ACCOUNTS = [
  { role: "operator" as Role, label: "Operador", sub: "Gestión de agenda, asignaciones y reportes", name: "Alex Moreau", title: "Jefa de Operaciones" },
  { role: "technician" as Role, label: "Técnico", sub: "Mis trabajos asignados y atención de emergencias", name: "Marcus Delgado", title: "Técnico Senior — Zona Norte" },
  { role: "client" as Role, label: "Cliente / Administración", sub: "Estado de mis edificios y ascensores", name: "Andrea Vásquez", title: "Administradora — Meridian Business Park" },
];

function LoginScreen({ onLogin }: { onLogin: (role: Role, name: string) => void }) {
  const [selected, setSelected] = useState<Role | null>(null);
  const [step, setStep] = useState<"pick" | "creds">("pick");

  const acc = LOGIN_ACCOUNTS.find((a) => a.role === selected);

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Barlow', sans-serif", background: "#0D1B2A" }}>
      {/* Left brand panel */}
      <div className="hidden lg:flex w-5/12 flex-col justify-between p-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="absolute border border-white/5 rounded" style={{ inset: `${i*40}px` }} />
          ))}
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-20">
            <div className="w-9 h-9 bg-[#EA580C] rounded flex items-center justify-center"><Building2 size={18} className="text-white" /></div>
            <span className="text-white text-xl font-bold tracking-wide">LiftOps</span>
          </div>
          <h1 className="text-5xl font-bold text-white leading-[1.15] mb-5">
            Gestión integral<br />de mantenimiento<br /><span className="text-[#EA580C]">de ascensores</span>
          </h1>
          <p className="text-slate-400 leading-relaxed max-w-xs">
            Plataforma para operadores, técnicos y clientes. Funciona online y offline con sincronización automática.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[{ n: "142", l: "Ascensores" }, { n: "98.4%", l: "Disponibilidad" }, { n: "18 min", l: "Respuesta media" }].map(s => (
            <div key={s.l} className="border border-white/10 rounded p-4">
              <div className="text-2xl font-bold text-[#EA580C]">{s.n}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Right auth panel */}
      <div className="flex-1 bg-[#F4F4F2] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {step === "pick" ? (
            <>
              <h2 className="text-3xl font-bold text-[#111827] mb-1">Iniciar sesión</h2>
              <p className="text-[#6B7280] mb-8">Selecciona tu tipo de cuenta</p>
              <div className="space-y-3 mb-8">
                {LOGIN_ACCOUNTS.map(a => (
                  <button key={a.role} onClick={() => setSelected(a.role)}
                    className={`w-full p-4 rounded border-2 text-left transition-all ${selected === a.role ? "border-[#EA580C] bg-white shadow-sm" : "border-[#E0E0DE] bg-white hover:border-slate-300"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`text-[10px] font-mono uppercase tracking-widest mb-0.5 ${selected === a.role ? "text-[#EA580C]" : "text-[#6B7280]"}`}>{a.role}</div>
                        <div className="font-semibold text-[#111827]">{a.label}</div>
                        <div className="text-xs text-[#6B7280]">{a.sub}</div>
                      </div>
                      <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected === a.role ? "border-[#EA580C] bg-[#EA580C]" : "border-slate-300"}`}>
                        {selected === a.role && <Check size={10} className="text-white" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => selected && setStep("creds")} disabled={!selected}
                className="w-full py-3.5 bg-[#0D1B2A] text-white rounded font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity">
                Continuar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep("pick")} className="flex items-center gap-1.5 text-[#6B7280] text-sm mb-8 hover:text-[#111827] transition-colors"><ArrowLeft size={13} /> Volver</button>
              <h2 className="text-3xl font-bold text-[#111827] mb-1">Bienvenido/a</h2>
              <p className="text-[#6B7280] mb-2">{acc?.name}</p>
              <p className="text-sm text-[#6B7280] mb-8 font-mono">{acc?.title}</p>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-widest text-[#6B7280] mb-1.5">Contraseña</label>
                  <input type="password" defaultValue="••••••••" className="w-full px-4 py-3 bg-white border border-[#E0E0DE] rounded focus:outline-none focus:border-[#EA580C] transition" />
                </div>
              </div>
              <button onClick={() => acc && onLogin(acc.role, acc.name)}
                className="w-full py-3.5 bg-[#EA580C] text-white rounded font-semibold hover:bg-[#C2410C] transition-colors">
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({ isOnline, onToggleOnline, emergencyCount, unreadCount }: {
  isOnline: boolean; onToggleOnline: () => void;
  emergencyCount: number; unreadCount: number;
}) {
  return (
    <div className="h-11 bg-white border-b border-[#E0E0DE] flex items-center px-6 gap-4 flex-shrink-0">
      <div className="flex-1" />
      {!isOnline && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
          <RefreshCw size={11} className="animate-spin" />
          Sincronización pendiente — 3 cambios
        </div>
      )}
      <button onClick={onToggleOnline} className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border transition-all ${isOnline ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
        {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
        {isOnline ? "Online" : "Offline"}
      </button>
      {emergencyCount > 0 && (
        <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-2.5 py-1 rounded animate-pulse">
          <Zap size={11} /> {emergencyCount} emergencia{emergencyCount > 1 ? "s" : ""}
        </div>
      )}
      <div className="relative">
        <Bell size={16} className="text-[#6B7280]" />
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EA580C] text-white text-[9px] rounded-full flex items-center justify-center font-bold">{unreadCount}</span>}
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ role, userName, activeView, onNavigate, onLogout }: {
  role: Role; userName: string; activeView: string;
  onNavigate: (v: string) => void; onLogout: () => void;
}) {
  const navs: Record<Role, { id: string; label: string; icon: React.ReactNode; group?: string }[]> = {
    operator: [
      { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} />, group: "General" },
      { id: "map", label: "Mapa", icon: <MapPin size={16} />, group: "General" },
      { id: "calendar", label: "Calendario", icon: <Calendar size={16} />, group: "General" },
      { id: "schedule", label: "Agenda", icon: <ClipboardList size={16} />, group: "Trabajos" },
      { id: "elevators", label: "Ascensores", icon: <Activity size={16} />, group: "Trabajos" },
      { id: "emergency", label: "Emergencias", icon: <Zap size={16} />, group: "Trabajos" },
      { id: "technicians", label: "Técnicos", icon: <Users size={16} />, group: "Equipo" },
      { id: "messages", label: "Mensajes", icon: <MessageSquare size={16} />, group: "Equipo" },
    ],
    technician: [
      { id: "my-jobs", label: "Mis Trabajos", icon: <ClipboardList size={16} />, group: "Trabajo" },
      { id: "map", label: "Mapa", icon: <MapPin size={16} />, group: "Trabajo" },
      { id: "emergency", label: "Emergencias", icon: <Zap size={16} />, group: "Trabajo" },
      { id: "messages", label: "Mensajes", icon: <MessageSquare size={16} />, group: "Comunicación" },
    ],
    client: [
      { id: "dashboard", label: "Mis Edificios", icon: <Building2 size={16} />, group: "General" },
      { id: "elevators", label: "Ascensores", icon: <Activity size={16} />, group: "General" },
      { id: "messages", label: "Mensajes", icon: <MessageSquare size={16} />, group: "Comunicación" },
    ],
  };

  const items = navs[role];
  const groups = [...new Set(items.map(i => i.group))];
  const initials = userName.split(" ").map(w => w[0]).join("").slice(0, 2);

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-[#0D1B2A] h-full overflow-y-auto" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div className="px-5 py-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#EA580C] rounded flex items-center justify-center"><Building2 size={13} className="text-white" /></div>
          <span className="text-white font-bold tracking-wide text-base">LiftOps</span>
        </div>
      </div>
      <div className="flex-1 px-3 py-3 space-y-4">
        {groups.map(group => (
          <div key={group}>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-600 px-2 mb-1">{group}</div>
            {items.filter(i => i.group === group).map(item => (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium transition-all mb-0.5 ${
                  activeView === item.id ? "bg-[#EA580C]/15 text-[#EA580C]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="px-3 pb-4 border-t border-white/[0.07] pt-3">
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div className="w-7 h-7 rounded bg-[#EA580C]/20 flex items-center justify-center text-[#EA580C] text-xs font-bold font-mono flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-200 truncate">{userName}</div>
            <div className="text-[9px] text-slate-500 capitalize font-mono">{role}</div>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// ─── Map View ─────────────────────────────────────────────────────────────────

function MapView({ role }: { role: Role }) {
  const [filter, setFilter] = useState<"all" | BuildingType>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const selectedBuilding = BUILDINGS.find(b => b.id === selected);
  const selectedTech = TECHNICIANS.find(t => t.id === selected);

  const streetLines = [
    [0,100,600,100],[0,200,600,200],[0,300,600,300],
    [100,0,100,400],[250,0,250,400],[400,0,400,400],[520,0,520,400],
  ];

  return (
    <div className="space-y-4" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">Mapa</h2>
          <p className="text-[#6B7280] text-sm">Posición de edificios y técnicos en tiempo real</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "residential", "hospital", "office", "hotel", "industrial"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs font-mono rounded border transition-all ${filter === f ? "bg-[#0D1B2A] border-[#0D1B2A] text-white" : "border-[#E0E0DE] text-[#6B7280] hover:border-slate-400"}`}>
              {f === "all" ? "Todos" : f}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1 bg-white border border-[#E0E0DE] rounded-lg overflow-hidden relative">
          <svg viewBox="0 0 600 400" className="w-full" style={{ background: "#F0EDE8" }}>
            {/* Street grid */}
            {streetLines.map(([x1,y1,x2,y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#DDD8D0" strokeWidth="8" />
            ))}
            {/* Building markers */}
            {BUILDINGS.filter(b => filter === "all" || b.type === filter).map(b => {
              const criticalElv = b.elevators.some(e => e.status === "critical");
              const warningElv = b.elevators.some(e => e.status === "warning");
              const color = criticalElv ? "#EF4444" : warningElv ? "#F59E0B" : BUILDING_TYPE_COLORS[b.type];
              const isSelected = selected === b.id;
              return (
                <g key={b.id} onClick={() => setSelected(isSelected ? null : b.id)} style={{ cursor: "pointer" }}>
                  {isSelected && <circle cx={b.mapX} cy={b.mapY} r="22" fill={color} opacity="0.15" />}
                  <rect x={b.mapX-12} y={b.mapY-12} width="24" height="24" rx="4" fill={color} />
                  <text x={b.mapX} y={b.mapY+1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10" fontWeight="bold">{b.elevators.length}</text>
                  <text x={b.mapX} y={b.mapY+20} textAnchor="middle" fill="#374151" fontSize="9" fontWeight="500">{b.name.split(" ").slice(0,2).join(" ")}</text>
                </g>
              );
            })}
            {/* Technician markers */}
            {(role === "operator") && TECHNICIANS.map(t => {
              const isSelected = selected === t.id;
              const color = t.status === "available" ? "#10B981" : t.status === "on_job" ? "#EA580C" : "#6B7280";
              return (
                <g key={t.id} onClick={() => setSelected(isSelected ? null : t.id)} style={{ cursor: "pointer" }}>
                  {t.status === "available" && <circle cx={t.mapX} cy={t.mapY} r="18" fill={color} opacity="0.15" />}
                  <circle cx={t.mapX} cy={t.mapY} r="13" fill={color} stroke="white" strokeWidth="2" />
                  <text x={t.mapX} y={t.mapY+1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="8" fontWeight="bold">{t.avatar}</text>
                </g>
              );
            })}
          </svg>
          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-white/90 rounded p-2 text-xs space-y-1 border border-[#E0E0DE]">
            {role === "operator" && <>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /> Disponible</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#EA580C]" /> En trabajo</div>
            </>}
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500" /> Crítico</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /> Advertencia</div>
          </div>
        </div>
        {/* Info panel */}
        <div className="w-64 space-y-3">
          {selectedBuilding && (
            <div className="bg-white border border-[#E0E0DE] rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-[#111827]">{selectedBuilding.name}</div>
                  <div className="text-xs text-[#6B7280]">{selectedBuilding.address}</div>
                </div>
                <button onClick={() => setSelected(null)}><X size={14} className="text-[#6B7280]" /></button>
              </div>
              <div className="text-xs font-mono text-[#6B7280] mb-3 capitalize">{selectedBuilding.type}</div>
              <div className="space-y-1.5">
                {selectedBuilding.elevators.map(e => (
                  <div key={e.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#111827]">{e.id}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${STATUS_ELV[e.status].dot}`} />
                      <span className={STATUS_ELV[e.status].color}>{STATUS_ELV[e.status].label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#F0F0EE] text-xs text-[#6B7280]">
                <div className="font-medium text-[#374151] mb-0.5">Contacto</div>
                {selectedBuilding.adminContact}
                <div className="text-[#EA580C]">{selectedBuilding.adminEmail}</div>
              </div>
            </div>
          )}
          {selectedTech && (
            <div className="bg-white border border-[#E0E0DE] rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#0D1B2A] flex items-center justify-center text-white text-xs font-bold font-mono">{selectedTech.avatar}</div>
                  <div>
                    <div className="font-semibold text-[#111827] text-sm">{selectedTech.name}</div>
                    <div className="text-xs text-[#6B7280]">{selectedTech.zone}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}><X size={14} className="text-[#6B7280]" /></button>
              </div>
              <div className="text-xs font-mono text-[#6B7280] mb-2">{selectedTech.phone}</div>
              <div className="text-xs text-[#374151] mb-2">Especialidad: <span className="font-medium">{selectedTech.specialty.map(s => EMERGENCY_LABELS[s]).join(", ")}</span></div>
              <div className={`inline-flex items-center text-xs font-mono px-2 py-0.5 rounded ${selectedTech.status === "available" ? "bg-green-50 text-green-700" : selectedTech.status === "on_job" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                {selectedTech.status === "available" ? "Disponible" : selectedTech.status === "on_job" ? "En trabajo" : "Offline"}
              </div>
            </div>
          )}
          {!selected && (
            <div className="bg-white border border-[#E0E0DE] rounded-lg p-4 text-sm text-[#6B7280]">
              Haz clic en un edificio o técnico para ver detalles.
            </div>
          )}
          <div className="bg-white border border-[#E0E0DE] rounded-lg p-4">
            <div className="text-xs font-mono uppercase tracking-widest text-[#6B7280] mb-3">Resumen</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#6B7280]">Edificios</span><span className="font-semibold text-[#111827]">{BUILDINGS.length}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Ascensores</span><span className="font-semibold text-[#111827]">{BUILDINGS.reduce((a,b)=>a+b.elevators.length,0)}</span></div>
              {role === "operator" && <>
                <div className="flex justify-between"><span className="text-[#6B7280]">Técnicos activos</span><span className="font-semibold text-[#111827]">{TECHNICIANS.filter(t=>t.status!=="offline").length}</span></div>
                <div className="flex justify-between"><span className="text-red-600]">Críticos</span><span className="font-semibold text-red-600">{BUILDINGS.flatMap(b=>b.elevators).filter(e=>e.status==="critical").length}</span></div>
              </>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ jobs, onUpdateJobs }: { jobs: Job[]; onUpdateJobs: (j: Job[]) => void }) {
  const [month, setMonth] = useState(6); // July (0-indexed)
  const [year, setYear] = useState(2026);
  const [replicatePreview, setReplicatePreview] = useState<{ conflicts: string[]; done: boolean } | null>(null);

  const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const DAYS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // offset to Mon

  function getJobsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return jobs.filter(j => j.scheduledDate === dateStr);
  }

  function dayColor(day: number) {
    const dayJobs = getJobsForDay(day);
    if (dayJobs.length === 0) return "";
    if (dayJobs.some(j => j.status === "overdue")) return "bg-red-500";
    if (dayJobs.some(j => j.status === "in_progress")) return "bg-amber-400";
    if (dayJobs.every(j => j.status === "completed")) return "bg-green-500";
    return "bg-blue-400";
  }

  function handleReplicate() {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const daysInNext = new Date(nextYear, nextMonth + 1, 0).getDate();
    const conflicts: string[] = [];
    const newJobs: Job[] = [];
    jobs.filter(j => {
      const d = new Date(j.scheduledDate + "T00:00:00");
      return d.getMonth() === month && d.getFullYear() === year;
    }).forEach(j => {
      const orig = new Date(j.scheduledDate + "T00:00:00");
      const nextDate = new Date(nextYear, nextMonth, orig.getDate());
      const dom = nextDate.getDate() > daysInNext ? daysInNext : nextDate.getDate();
      const nextDateFinal = new Date(nextYear, nextMonth, dom);
      const isSunday = nextDateFinal.getDay() === 0;
      const dateStr = `${nextYear}-${String(nextMonth+1).padStart(2,"0")}-${String(dom).padStart(2,"0")}`;
      if (isSunday) conflicts.push(`${j.id} → ${dateStr} (domingo)`);
      newJobs.push({ ...j, id: `WO-${3000 + Math.floor(Math.random()*999)}`, scheduledDate: dateStr, status: "scheduled", checklist: j.checklist.map(c => ({ ...c, done: false })) });
    });
    setReplicatePreview({ conflicts, done: false });
    if (conflicts.length === 0) {
      onUpdateJobs([...jobs, ...newJobs]);
      setReplicatePreview({ conflicts: [], done: true });
    } else {
      setReplicatePreview({ conflicts, done: false });
    }
  }

  function confirmReplicate() {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const daysInNext = new Date(nextYear, nextMonth + 1, 0).getDate();
    const newJobs: Job[] = jobs.filter(j => {
      const d = new Date(j.scheduledDate + "T00:00:00");
      return d.getMonth() === month && d.getFullYear() === year;
    }).map(j => {
      const orig = new Date(j.scheduledDate + "T00:00:00");
      const dom = Math.min(orig.getDate(), daysInNext);
      const dateStr = `${nextYear}-${String(nextMonth+1).padStart(2,"0")}-${String(dom).padStart(2,"0")}`;
      return { ...j, id: `WO-${3000+Math.floor(Math.random()*999)}`, scheduledDate: dateStr, status: "scheduled" as JobStatus, checklist: j.checklist.map(c => ({ ...c, done: false })) };
    });
    onUpdateJobs([...jobs, ...newJobs]);
    setReplicatePreview({ conflicts: [], done: true });
  }

  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">Calendario</h2>
          <p className="text-[#6B7280] text-sm">Semáforo diario de mantenciones — verde completo, rojo pendiente</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }}
            className="w-8 h-8 rounded border border-[#E0E0DE] flex items-center justify-center hover:bg-[#F0F0EE] text-[#374151]">‹</button>
          <span className="font-semibold text-[#111827] min-w-[120px] text-center">{MONTHS[month]} {year}</span>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }}
            className="w-8 h-8 rounded border border-[#E0E0DE] flex items-center justify-center hover:bg-[#F0F0EE] text-[#374151]">›</button>
          <button onClick={handleReplicate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0D1B2A] text-white rounded hover:opacity-90 transition-opacity">
            <Copy size={12} /> Replicar a {MONTHS[month === 11 ? 0 : month + 1]}
          </button>
        </div>
      </div>

      {replicatePreview && (
        <div className={`border rounded-lg p-4 ${replicatePreview.done ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          {replicatePreview.done ? (
            <div className="flex items-center gap-2 text-green-700 text-sm"><CheckCircle2 size={15} /> Replicación completada con éxito.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2"><AlertTriangle size={14} /> {replicatePreview.conflicts.length} conflicto{replicatePreview.conflicts.length > 1 ? "s" : ""} con domingo detectados</div>
              <div className="space-y-1 mb-3">
                {replicatePreview.conflicts.map(c => <div key={c} className="text-xs font-mono text-amber-700">{c} — reagendar manualmente</div>)}
              </div>
              <div className="flex gap-2">
                <button onClick={confirmReplicate} className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700">Replicar de todas formas</button>
                <button onClick={() => setReplicatePreview(null)} className="px-3 py-1.5 text-xs text-amber-700 border border-amber-300 rounded hover:bg-amber-100">Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="bg-white border border-[#E0E0DE] rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#F0F0EE]">
          {DAYS.map(d => (
            <div key={d} className={`py-2 text-center text-xs font-mono uppercase tracking-widest ${d === "Dom" ? "text-red-400" : "text-[#6B7280]"}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} className="border-b border-r border-[#F8F8F6] h-24" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayJobs = getJobsForDay(day);
            const color = dayColor(day);
            const col = (i + offset) % 7;
            const isSunday = col === 6;
            return (
              <div key={day} className={`border-b border-r border-[#F8F8F6] h-24 p-1.5 relative ${isSunday ? "bg-red-50/30" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold ${isSunday ? "text-red-400" : "text-[#374151]"}`}>{day}</span>
                  {color && <div className={`w-2.5 h-2.5 rounded-full ${color}`} />}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayJobs.slice(0,3).map(j => (
                    <div key={j.id} className="text-[9px] font-mono truncate px-1 py-0.5 rounded bg-[#F0F0EE] text-[#374151]">
                      {j.scheduledTime} {j.elevatorLabel}
                    </div>
                  ))}
                  {dayJobs.length > 3 && <div className="text-[9px] text-[#6B7280] pl-1">+{dayJobs.length-3}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-4 flex-wrap">
        {[{ color: "bg-green-500", label: "Todo completado" }, { color: "bg-red-500", label: "Pendiente / Vencido" }, { color: "bg-amber-400", label: "En curso" }, { color: "bg-blue-400", label: "Programado" }].map(l => (
          <div key={l.label} className="flex items-center gap-2 text-xs text-[#6B7280]">
            <div className={`w-3 h-3 rounded-full ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Elevator Browser + Detail ────────────────────────────────────────────────

function ElevatorBrowser({ onSelectElevator }: { onSelectElevator: (e: Elevator, b: Building) => void }) {
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);

  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div>
        <h2 className="text-2xl font-bold text-[#111827]">Ascensores</h2>
        <p className="text-[#6B7280] text-sm">Jerarquía: Cliente → Edificio → Ascensor → Bitácora</p>
      </div>
      <div className="space-y-2">
        {BUILDINGS.map(b => {
          const critical = b.elevators.filter(e => e.status === "critical").length;
          const warning = b.elevators.filter(e => e.status === "warning").length;
          return (
            <div key={b.id} className="bg-white border border-[#E0E0DE] rounded-lg overflow-hidden">
              <button onClick={() => setExpandedBuilding(expandedBuilding === b.id ? null : b.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-[#FAFAF9] transition-colors text-left">
                <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: BUILDING_TYPE_COLORS[b.type] + "20", color: BUILDING_TYPE_COLORS[b.type] }}>
                  {BUILDING_TYPE_ICONS[b.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#111827]">{b.name}</div>
                  <div className="text-xs text-[#6B7280]">{b.address}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {critical > 0 && <span className="text-xs font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{critical} crítico{critical>1?"s":""}</span>}
                  {warning > 0 && <span className="text-xs font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{warning} adv.</span>}
                  <span className="text-xs text-[#6B7280] font-mono">{b.elevators.length} asc.</span>
                  <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${expandedBuilding === b.id ? "rotate-180" : ""}`} />
                </div>
              </button>
              {expandedBuilding === b.id && (
                <div className="border-t border-[#F0F0EE] divide-y divide-[#F0F0EE]">
                  {b.elevators.map(e => (
                    <button key={e.id} onClick={() => onSelectElevator(e, b)}
                      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#FAFAF9] transition-colors text-left">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_ELV[e.status].dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-semibold text-[#111827]">{e.id}</span>
                          <span className="text-xs text-[#6B7280]">{e.brand} {e.model} — {e.floors} pisos</span>
                        </div>
                        <div className="text-xs text-[#6B7280] font-mono">Último mant.: {fmtDate(e.lastMaintenance)} · Fallo: {e.failureRate}%</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${STATUS_ELV[e.status].color}`}>{STATUS_ELV[e.status].label}</span>
                        <ChevronRight size={13} className="text-[#6B7280]" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ElevatorDetail({ elevator, building, onBack }: { elevator: Elevator; building: Building; onBack: () => void }) {
  const [tab, setTab] = useState<"overview" | "logbook" | "qr">("overview");

  const failureData = [
    { month: "Ene", rate: elevator.failureRate * 0.7 },
    { month: "Feb", rate: elevator.failureRate * 0.8 },
    { month: "Mar", rate: elevator.failureRate * 0.9 },
    { month: "Abr", rate: elevator.failureRate * 1.1 },
    { month: "May", rate: elevator.failureRate * 1.2 },
    { month: "Jun", rate: elevator.failureRate },
  ].map(d => ({ ...d, rate: parseFloat(d.rate.toFixed(1)) }));

  const hasNonOriginal = elevator.logbook.some(l => l.parts.some(p => !p.isOriginal));

  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[#6B7280] text-sm hover:text-[#111827] transition-colors"><ArrowLeft size={13} /> Volver a Ascensores</button>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-[#EA580C] font-bold text-lg">{elevator.id}</span>
            <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded ${STATUS_ELV[elevator.status].color} ${elevator.status === "critical" ? "bg-red-50" : elevator.status === "warning" ? "bg-amber-50" : "bg-green-50"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${STATUS_ELV[elevator.status].dot}`} />
              {STATUS_ELV[elevator.status].label}
            </div>
            {hasNonOriginal && <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700">Piezas mixtas</span>}
          </div>
          <h2 className="text-xl font-bold text-[#111827]">{building.name} — {elevator.brand} {elevator.model}</h2>
          <p className="text-[#6B7280] text-sm">{building.address} · Instalado {elevator.installYear} · {elevator.floors} pisos</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["overview","logbook","qr"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded transition-all ${tab === t ? "bg-[#0D1B2A] text-white" : "text-[#6B7280] border border-[#E0E0DE] hover:border-slate-300"}`}>
            {t === "overview" ? "Resumen" : t === "logbook" ? "Bitácora" : "QR / ID"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-[#E0E0DE] rounded-lg p-5">
            <h3 className="font-semibold text-[#111827] mb-4 text-sm uppercase tracking-wider">Tasa de Fallo Mensual</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={failureData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0EE" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, "Tasa de fallo"]} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E0E0DE" }} />
                <Bar dataKey="rate" fill={elevator.failureRate > 15 ? "#EF4444" : elevator.failureRate > 8 ? "#F59E0B" : "#10B981"} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white border border-[#E0E0DE] rounded-lg p-5">
            <h3 className="font-semibold text-[#111827] mb-4 text-sm uppercase tracking-wider">Ficha Técnica</h3>
            <dl className="space-y-3">
              {[
                { label: "Marca / Modelo", value: `${elevator.brand} ${elevator.model}` },
                { label: "Año instalación", value: String(elevator.installYear) },
                { label: "Pisos", value: String(elevator.floors) },
                { label: "Último mantenimiento", value: fmtDate(elevator.lastMaintenance) },
                { label: "Tasa fallo actual", value: `${elevator.failureRate}%` },
                { label: "Componentes", value: hasNonOriginal ? "⚠ Mixtos (OEM + 3ros)" : "✓ Originales" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <dt className="text-[#6B7280]">{label}</dt>
                  <dd className={`font-medium ${label.includes("Tasa") && elevator.failureRate > 15 ? "text-red-600" : label.includes("Componentes") && hasNonOriginal ? "text-amber-700" : "text-[#111827]"}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {tab === "logbook" && (
        <div className="space-y-3">
          {elevator.logbook.length === 0 ? (
            <div className="bg-white border border-[#E0E0DE] rounded-lg p-8 text-center text-[#6B7280]">Sin registros en bitácora.</div>
          ) : elevator.logbook.map(entry => (
            <div key={entry.id} className="bg-white border border-[#E0E0DE] rounded-lg p-5">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-[#6B7280]">{fmtDate(entry.date)}</span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                      entry.type === "emergency" ? "bg-red-50 text-red-700" : entry.type === "repair" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                    }`}>{JOB_TYPE_LABELS[entry.type]}</span>
                  </div>
                  <div className="text-sm text-[#374151]">{entry.description}</div>
                  <div className="text-xs text-[#6B7280] mt-1">Técnico: {entry.technicianName}</div>
                </div>
              </div>
              {entry.parts.length > 0 && (
                <div className="mt-3 border-t border-[#F0F0EE] pt-3">
                  <div className="text-xs font-mono uppercase tracking-widest text-[#6B7280] mb-2">Piezas reemplazadas</div>
                  <div className="space-y-1.5">
                    {entry.parts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-[#374151]">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#6B7280]">{p.brand}</span>
                          <span className={`px-1.5 py-0.5 rounded ${p.isOriginal ? "bg-green-50 text-green-700" : "bg-purple-50 text-purple-700"}`}>
                            {p.isOriginal ? "Original" : "3° parte"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "qr" && (
        <div className="bg-white border border-[#E0E0DE] rounded-lg p-8 flex flex-col items-center gap-5">
          <QRSvg code={elevator.qrCode} />
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-[#111827] mb-1">{elevator.qrCode}</div>
            <div className="text-sm text-[#6B7280]">ID único del ascensor — escanear para acceso rápido</div>
          </div>
          <div className="text-xs font-mono text-[#6B7280] border border-dashed border-[#E0E0DE] rounded px-6 py-3 text-center">
            {elevator.id} · {building.name} · {elevator.brand} {elevator.model}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm border border-[#E0E0DE] rounded text-[#374151] hover:bg-[#F0F0EE] transition-colors">
            <FileText size={14} /> Imprimir etiqueta
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Emergency View ────────────────────────────────────────────────────────────

function EmergencyView({ emergencies, role }: { emergencies: Emergency[]; role: Role }) {
  const [selected, setSelected] = useState<Emergency | null>(emergencies.find(e => e.status === "active") || null);

  const nearestTechs = useMemo(() => {
    if (!selected) return [];
    const building = BUILDINGS.find(b => b.id === selected.buildingId);
    if (!building) return [];
    return [...TECHNICIANS]
      .filter(t => t.status !== "offline")
      .map(t => ({ ...t, distance: dist(t.mapX, t.mapY, building.mapX, building.mapY) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }, [selected]);

  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div>
        <h2 className="text-2xl font-bold text-[#111827]">Emergencias</h2>
        <p className="text-[#6B7280] text-sm">Respuesta inmediata — 3 técnicos más cercanos notificados</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-3">
          {emergencies.map(em => (
            <button key={em.id} onClick={() => setSelected(em)}
              className={`w-full text-left rounded-lg border p-4 transition-all ${selected?.id === em.id ? "border-red-400 shadow-sm" : "border-[#E0E0DE] bg-white hover:border-red-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`${EMERGENCY_COLORS[em.type]} text-white rounded px-2 py-0.5 text-xs font-mono flex-shrink-0`}>{em.type.toUpperCase()}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${em.status === "active" ? "bg-red-50 text-red-700 animate-pulse" : em.status === "responding" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                      {em.status === "active" ? "ACTIVA" : em.status === "responding" ? "RESPONDIENDO" : "RESUELTA"}
                    </span>
                  </div>
                  <div className="font-semibold text-[#111827] text-sm">{EMERGENCY_LABELS[em.type]}</div>
                  <div className="text-xs text-[#6B7280]">{em.buildingName} · {em.elevatorId}</div>
                  <div className="text-xs font-mono text-[#6B7280]">{fmtTime(em.reportedAt)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {selected && (
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border border-red-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`${EMERGENCY_COLORS[selected.type]} text-white rounded px-2 py-1 text-sm font-semibold`}>{EMERGENCY_LABELS[selected.type]}</div>
                <span className="font-mono text-xs text-[#6B7280]">{selected.id}</span>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed mb-3">{selected.description}</p>
              <div className="text-xs text-[#6B7280] font-mono">Reportado: {fmtTime(selected.reportedAt)} · {selected.buildingName} · {selected.elevatorId}</div>
            </div>
            <div className="bg-white border border-[#E0E0DE] rounded-lg p-5">
              <h3 className="font-semibold text-[#111827] mb-4 text-sm uppercase tracking-wider">3 Técnicos más cercanos</h3>
              <div className="space-y-3">
                {nearestTechs.map((t, idx) => {
                  const hasSpecialty = t.specialty.includes(selected.type);
                  return (
                    <div key={t.id} className={`flex items-center gap-4 p-3 rounded border ${idx === 0 ? "border-[#EA580C]/30 bg-[#EA580C]/5" : "border-[#F0F0EE]"}`}>
                      <div className="w-8 h-8 rounded bg-[#0D1B2A] flex items-center justify-center text-white text-xs font-bold font-mono flex-shrink-0">{t.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-[#111827]">{t.name}</span>
                          {idx === 0 && <span className="text-[9px] font-mono bg-[#EA580C] text-white px-1.5 py-0.5 rounded">MÁS CERCANO</span>}
                          {hasSpecialty && <span className="text-[9px] font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded">ESPECIALISTA</span>}
                        </div>
                        <div className="text-xs text-[#6B7280]">{t.zone} · {t.phone}</div>
                        <div className="text-xs font-mono text-[#6B7280]">~{Math.round(t.distance / 10)} min estimado</div>
                      </div>
                      {role === "operator" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button className="p-2 rounded border border-[#E0E0DE] hover:bg-[#F0F0EE] text-[#374151]"><Phone size={13} /></button>
                          <button className="p-2 rounded bg-[#EA580C] text-white hover:bg-[#C2410C]"><Send size={13} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Messages View ────────────────────────────────────────────────────────────

function MessagesView({ messages, role, userName }: { messages: Message[]; role: Role; userName: string }) {
  const [selected, setSelected] = useState<Message | null>(messages[0] || null);
  const [reply, setReply] = useState("");
  const [msgs, setMsgs] = useState(messages);

  function handleReply() {
    if (!reply.trim() || !selected) return;
    const updated = { ...selected, thread: [...selected.thread, { from: userName, body: reply, sentAt: new Date().toISOString() }] };
    setMsgs(prev => prev.map(m => m.id === selected.id ? updated : m));
    setSelected(updated);
    setReply("");
  }

  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div>
        <h2 className="text-2xl font-bold text-[#111827]">Mensajes</h2>
        <p className="text-[#6B7280] text-sm">Comunicación interna y correos a administración</p>
      </div>
      <div className="flex gap-4 bg-white border border-[#E0E0DE] rounded-lg overflow-hidden" style={{ minHeight: 460 }}>
        <div className="w-72 border-r border-[#F0F0EE] overflow-y-auto flex-shrink-0">
          {msgs.map(m => (
            <button key={m.id} onClick={() => setSelected(m)}
              className={`w-full text-left p-4 border-b border-[#F8F8F6] hover:bg-[#FAFAF9] transition-colors ${selected?.id === m.id ? "bg-[#F4F4F2]" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${!m.read ? "text-[#111827]" : "text-[#374151]"}`}>{m.from}</span>
                <span className="text-[9px] font-mono text-[#6B7280]">{fmtTime(m.sentAt)}</span>
              </div>
              <div className={`text-xs truncate mb-0.5 ${!m.read ? "font-semibold text-[#374151]" : "text-[#6B7280]"}`}>{m.subject}</div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded capitalize ${m.fromRole === "technician" ? "bg-amber-50 text-amber-700" : m.fromRole === "admin" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{m.fromRole}</span>
                {!m.read && <div className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />}
              </div>
            </button>
          ))}
        </div>
        {selected ? (
          <div className="flex-1 flex flex-col">
            <div className="p-5 border-b border-[#F0F0EE]">
              <div className="font-semibold text-[#111827] mb-0.5">{selected.subject}</div>
              <div className="text-xs text-[#6B7280]">De: {selected.from} · {fmtTime(selected.sentAt)}</div>
            </div>
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <div className="text-sm text-[#374151] leading-relaxed bg-[#F8F8F6] rounded p-3">{selected.body}</div>
              {selected.thread.map((t, i) => (
                <div key={i} className={`flex ${t.from === userName ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs p-3 rounded text-sm leading-relaxed ${t.from === userName ? "bg-[#0D1B2A] text-white" : "bg-[#F0F0EE] text-[#374151]"}`}>
                    <div className="text-xs opacity-60 mb-1 font-mono">{t.from}</div>
                    {t.body}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[#F0F0EE] flex gap-2">
              <input value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReply()}
                placeholder="Responder..." className="flex-1 px-3 py-2 text-sm bg-[#F8F8F6] border border-[#E0E0DE] rounded focus:outline-none focus:border-[#EA580C] transition" />
              <button onClick={handleReply} className="px-3 py-2 bg-[#EA580C] text-white rounded hover:bg-[#C2410C] transition-colors">
                <Send size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#6B7280] text-sm">Selecciona un mensaje</div>
        )}
      </div>
    </div>
  );
}

// ─── Operator Dashboard ───────────────────────────────────────────────────────

function OperatorDashboard({ jobs, emergencies }: { jobs: Job[]; emergencies: Emergency[] }) {
  const allElevators = BUILDINGS.flatMap(b => b.elevators);
  const stats = [
    { label: "Total Ascensores", value: allElevators.length, sub: `${BUILDINGS.length} edificios`, color: "text-[#0D1B2A]" },
    { label: "Críticos", value: allElevators.filter(e=>e.status==="critical").length, sub: "requieren atención", color: "text-red-600" },
    { label: "Trabajos hoy", value: jobs.filter(j=>j.scheduledDate==="2026-07-01").length, sub: "programados", color: "text-blue-600" },
    { label: "Emergencias", value: emergencies.filter(e=>e.status!=="resolved").length, sub: "activas", color: "text-[#EA580C]" },
  ];

  const completionData = [
    { name: "Completado", value: jobs.filter(j=>j.status==="completed").length, color: "#10B981" },
    { name: "Programado", value: jobs.filter(j=>j.status==="scheduled").length, color: "#3B82F6" },
    { name: "En curso", value: jobs.filter(j=>j.status==="in_progress").length, color: "#F59E0B" },
    { name: "Vencido", value: jobs.filter(j=>j.status==="overdue").length, color: "#EF4444" },
  ];

  return (
    <div className="space-y-7" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div>
        <h2 className="text-2xl font-bold text-[#111827]">Dashboard</h2>
        <p className="text-[#6B7280] text-sm">Resumen operacional — Julio 2026</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-[#E0E0DE] rounded-lg p-5">
            <div className={`text-3xl font-bold mb-1 ${s.color}`} style={{ fontFamily: "'Barlow', sans-serif" }}>{s.value}</div>
            <div className="font-semibold text-[#111827] text-sm mb-0.5">{s.label}</div>
            <div className="text-xs text-[#6B7280]">{s.sub}</div>
          </div>
        ))}
      </div>
      {emergencies.filter(e => e.status !== "resolved").length > 0 && (
        <div className="bg-red-600 text-white rounded-lg p-4 flex items-center gap-4">
          <Zap size={20} className="flex-shrink-0" />
          <div>
            <div className="font-bold">Emergencia activa: {emergencies.find(e=>e.status==="active")?.buildingName}</div>
            <div className="text-red-100 text-sm">{emergencies.find(e=>e.status==="active") ? EMERGENCY_LABELS[emergencies.find(e=>e.status==="active")!.type] : ""} — Ver sección Emergencias</div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-[#E0E0DE] rounded-lg p-5">
          <h3 className="font-semibold text-[#111827] mb-4 text-sm uppercase tracking-wider">Próximos Trabajos</h3>
          <div className="space-y-2">
            {jobs.filter(j=>j.status!=="completed").slice(0,5).map(j => (
              <div key={j.id} className="flex items-center justify-between py-2.5 border-b border-[#F8F8F6] last:border-0">
                <div>
                  <span className="font-mono text-xs text-[#EA580C] mr-2">{j.id}</span>
                  <span className="text-sm text-[#111827]">{JOB_TYPE_LABELS[j.type]} — {j.elevatorLabel}</span>
                  <div className="text-xs text-[#6B7280]">{j.buildingName}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono text-xs text-[#6B7280]">{fmtDate(j.scheduledDate)}</span>
                  <StatusBadge status={j.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-[#E0E0DE] rounded-lg p-5">
          <h3 className="font-semibold text-[#111827] mb-4 text-sm uppercase tracking-wider">Estado de Órdenes</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={completionData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                {completionData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {completionData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}</div>
                <span className="font-semibold text-[#111827]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule View ────────────────────────────────────────────────────────────

function ScheduleView({ jobs, onUpdateJobs }: { jobs: Job[]; onUpdateJobs: (j: Job[]) => void }) {
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const filtered = filter === "all" ? jobs : jobs.filter(j => j.status === filter);

  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">Agenda de Trabajos</h2>
          <p className="text-[#6B7280] text-sm">Todas las órdenes de trabajo</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2.5 bg-[#EA580C] text-white text-sm font-semibold rounded hover:bg-[#C2410C] transition-colors">
          <Plus size={14} /> Nueva Orden
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(["all","scheduled","in_progress","overdue","completed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-mono rounded-full border transition-all ${filter === f ? "bg-[#0D1B2A] border-[#0D1B2A] text-white" : "border-[#E0E0DE] text-[#6B7280] hover:border-slate-400"}`}>
            {f === "all" ? `Todo (${jobs.length})` : { scheduled:"Programado", in_progress:"En curso", overdue:"Vencido", completed:"Completado" }[f]}
          </button>
        ))}
      </div>
      <div className="bg-white border border-[#E0E0DE] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F0F0EE] bg-[#F8F8F6]">
              {["Orden","Ascensor","Edificio","Tipo","Fecha","Técnico","Prioridad","Estado"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-[#6B7280]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((j, i) => (
              <tr key={j.id} className={`border-b border-[#F0F0EE] hover:bg-[#FAFAF9] transition-colors ${i===filtered.length-1?"border-0":""}`}>
                <td className="px-4 py-3 font-mono text-xs text-[#EA580C] font-semibold">{j.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#111827]">{j.elevatorLabel}</td>
                <td className="px-4 py-3 text-xs"><div className="font-medium text-[#111827]">{j.buildingName}</div></td>
                <td className="px-4 py-3 text-xs text-[#374151]">{JOB_TYPE_LABELS[j.type]}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#374151]">{fmtDate(j.scheduledDate)}</td>
                <td className="px-4 py-3 text-xs text-[#374151]">{j.technicianName}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold font-mono ${PRIORITY_CFG[j.priority].color}`}>{PRIORITY_CFG[j.priority].label}</span></td>
                <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Technicians Overview ─────────────────────────────────────────────────────

function TechniciansView({ jobs }: { jobs: Job[] }) {
  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div><h2 className="text-2xl font-bold text-[#111827]">Técnicos</h2><p className="text-[#6B7280] text-sm">Equipo de campo y carga de trabajo</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {TECHNICIANS.map(t => {
          const tJobs = jobs.filter(j => j.technicianId === t.id);
          return (
            <div key={t.id} className="bg-white border border-[#E0E0DE] rounded-lg p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded bg-[#0D1B2A] flex items-center justify-center text-white text-sm font-bold font-mono flex-shrink-0">{t.avatar}</div>
                <div>
                  <div className="font-semibold text-[#111827]">{t.name}</div>
                  <div className="text-xs text-[#6B7280]">{t.zone} · {t.phone}</div>
                  <div className={`text-xs font-mono mt-1 inline-block px-2 py-0.5 rounded ${t.status==="available"?"bg-green-50 text-green-700":t.status==="on_job"?"bg-amber-50 text-amber-700":"bg-slate-100 text-slate-500"}`}>
                    {t.status==="available"?"Disponible":t.status==="on_job"?"En trabajo":"Offline"}
                  </div>
                </div>
                <div className="ml-auto text-xs font-mono text-[#6B7280]">{t.id}</div>
              </div>
              <div className="text-xs text-[#6B7280] mb-3">Especialidades: {t.specialty.map(s=>EMERGENCY_LABELS[s]).join(", ")}</div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#F0F0EE]">
                {[{label:"Programados",v:tJobs.filter(j=>j.status==="scheduled").length,c:"text-blue-600"},{label:"En curso",v:tJobs.filter(j=>j.status==="in_progress").length,c:"text-amber-600"},{label:"Vencidos",v:tJobs.filter(j=>j.status==="overdue").length,c:"text-red-600"}].map(s=>(
                  <div key={s.label} className="text-center">
                    <div className={`text-xl font-bold ${s.c}`} style={{ fontFamily:"'Barlow',sans-serif" }}>{s.v}</div>
                    <div className="text-[10px] text-[#6B7280]">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Technician: My Jobs + Papeleta ──────────────────────────────────────────

function Papeleta({ job, onClose }: { job: Job; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ fontFamily: "'Barlow', sans-serif" }}>
        <div className="bg-[#0D1B2A] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-6 h-6 bg-[#EA580C] rounded flex items-center justify-center"><Building2 size={12} className="text-white" /></div><span className="text-white font-bold">LiftOps — Papeleta Digital</span></div>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#6B7280] mb-0.5">Orden de Trabajo</div>
              <div className="text-2xl font-bold text-[#EA580C]">{job.id}</div>
            </div>
            <QRSvg code={job.elevatorId} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border-t border-[#F0F0EE] pt-4">
            {[["Tipo",JOB_TYPE_LABELS[job.type]],["Ascensor",job.elevatorId],["Edificio",job.buildingName],["Fecha",`${fmtDate(job.scheduledDate)} ${job.scheduledTime}`],["Técnico",job.technicianName],["Prioridad",PRIORITY_CFG[job.priority].label]].map(([l,v])=>(
              <div key={l}><div className="text-[10px] font-mono uppercase tracking-widest text-[#6B7280] mb-0.5">{l}</div><div className="font-medium text-[#111827]">{v}</div></div>
            ))}
          </div>
          <div className="border-t border-[#F0F0EE] pt-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#6B7280] mb-2">Checklist</div>
            <div className="space-y-1.5">
              {job.checklist.map((c,i)=>(
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${c.done?"bg-green-600 border-green-600":"border-[#CBD5E1]"}`}>
                    {c.done && <Check size={9} className="text-white" />}
                  </div>
                  <span className={c.done?"line-through text-[#6B7280]":"text-[#374151]"}>{c.item}</span>
                </div>
              ))}
            </div>
          </div>
          {job.notes && <div className="bg-amber-50 border border-amber-100 rounded p-3 text-xs text-amber-800"><span className="font-semibold">Notas: </span>{job.notes}</div>}
          <div className="border-t border-dashed border-[#E0E0DE] pt-4 grid grid-cols-2 gap-4">
            <div><div className="text-[10px] font-mono uppercase tracking-widest text-[#6B7280] mb-4">Firma Técnico</div><div className="h-10 border-b border-[#111827]" /></div>
            <div><div className="text-[10px] font-mono uppercase tracking-widest text-[#6B7280] mb-4">Firma Cliente</div><div className="h-10 border-b border-[#111827]" /></div>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-[#F0F0EE] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-[#0D1B2A] text-white rounded hover:opacity-90">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function TechJobDetail({ job, onBack, onUpdateJob }: { job: Job; onBack: () => void; onUpdateJob: (j: Job) => void }) {
  const [local, setLocal] = useState(job);
  const [showPapeleta, setShowPapeleta] = useState(false);

  function toggleItem(i: number) {
    const updated = { ...local, checklist: local.checklist.map((c,idx)=>idx===i?{...c,done:!c.done}:c) };
    const allDone = updated.checklist.every(c=>c.done);
    if (allDone) updated.status = "completed";
    setLocal(updated); onUpdateJob(updated);
  }

  const progress = Math.round(local.checklist.filter(c=>c.done).length / local.checklist.length * 100);

  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      {showPapeleta && <Papeleta job={local} onClose={() => setShowPapeleta(false)} />}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[#6B7280] text-sm hover:text-[#111827] transition-colors"><ArrowLeft size={13} /> Mis Trabajos</button>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="font-mono text-[#EA580C] font-semibold">{local.id}</span><StatusBadge status={local.status} /></div>
          <h2 className="text-xl font-bold text-[#111827]">{JOB_TYPE_LABELS[local.type]} — {local.elevatorLabel}</h2>
          <p className="text-[#6B7280] text-sm">{local.buildingName} · {local.address}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowPapeleta(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[#E0E0DE] rounded text-[#374151] hover:bg-[#F0F0EE]"><FileText size={13} /> Papeleta</button>
          {local.status === "scheduled" && <button onClick={() => { const u={...local,status:"in_progress" as JobStatus}; setLocal(u); onUpdateJob(u); }} className="px-3 py-2 text-xs bg-amber-500 text-white rounded hover:bg-amber-600">Iniciar</button>}
          {local.status === "in_progress" && <button onClick={() => { const u={...local,status:"completed" as JobStatus}; setLocal(u); onUpdateJob(u); }} className="px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700">Completar</button>}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-3">
          <div className="bg-white border border-[#E0E0DE] rounded-lg p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#6B7280] mb-3">Detalles</div>
            <dl className="space-y-2.5 text-sm">
              {[["Ascensor",local.elevatorLabel],["Fecha",`${fmtDate(local.scheduledDate)} ${local.scheduledTime}`],["Edificio",local.buildingName],["Dirección",local.address]].map(([l,v])=>(
                <div key={l}><dt className="text-[#6B7280] text-xs">{l}</dt><dd className="font-medium text-[#111827] font-mono text-xs">{v}</dd></div>
              ))}
            </dl>
          </div>
          {local.notes && <div className="bg-amber-50 border border-amber-100 rounded p-3 text-xs text-amber-800">{local.notes}</div>}
        </div>
        <div className="lg:col-span-2 bg-white border border-[#E0E0DE] rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[#111827] text-sm uppercase tracking-wider">Checklist</div>
            <span className="font-mono text-xs text-[#6B7280]">{local.checklist.filter(c=>c.done).length}/{local.checklist.length}</span>
          </div>
          <div className="h-1.5 bg-[#F0F0EE] rounded-full mb-4 overflow-hidden"><div className="h-full bg-[#EA580C] rounded-full transition-all duration-500" style={{ width:`${progress}%` }} /></div>
          <div className="space-y-2">
            {local.checklist.map((item,i)=>(
              <button key={i} onClick={()=>toggleItem(i)}
                className={`w-full flex items-center gap-3 p-3 rounded border text-left transition-all group ${item.done?"border-green-100 bg-green-50":"border-[#E0E0DE] hover:border-[#111827]/20"}`}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.done?"bg-green-600 border-green-600":"border-[#CBD5E1]"}`}>
                  {item.done && <Check size={10} className="text-white" />}
                </div>
                <span className={`text-sm ${item.done?"line-through text-[#6B7280]":"text-[#111827]"}`}>{item.item}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TechMyJobs({ jobs, onSelect }: { jobs: Job[]; onSelect: (j: Job) => void }) {
  const myId = "T01";
  const myJobs = jobs.filter(j => j.technicianId === myId).sort((a,b) => {
    const o: Record<JobStatus,number> = { overdue:0, in_progress:1, scheduled:2, completed:3 };
    return o[a.status] - o[b.status];
  });
  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div><h2 className="text-2xl font-bold text-[#111827]">Mis Trabajos</h2><p className="text-[#6B7280] text-sm">Marcus Delgado — Zona Norte — {myJobs.length} órdenes asignadas</p></div>
      <div className="space-y-3">
        {myJobs.map(j => {
          const done = j.checklist.filter(c=>c.done).length;
          return (
            <button key={j.id} onClick={() => onSelect(j)} className="w-full bg-white border border-[#E0E0DE] rounded-lg p-4 text-left hover:border-[#111827]/20 hover:shadow-sm transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-mono text-xs text-[#EA580C] font-semibold">{j.id}</span>
                    <StatusBadge status={j.status} />
                    <span className={`text-[10px] font-mono font-semibold ${PRIORITY_CFG[j.priority].color}`}>{PRIORITY_CFG[j.priority].label}</span>
                  </div>
                  <div className="font-semibold text-[#111827] mb-0.5">{JOB_TYPE_LABELS[j.type]} — {j.elevatorLabel}</div>
                  <div className="text-xs text-[#374151]">{j.buildingName}</div>
                  <div className="text-xs font-mono text-[#6B7280] mt-1">{fmtDate(j.scheduledDate)} {j.scheduledTime}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-mono text-[#6B7280]">{done}/{j.checklist.length}</div>
                    <div className="w-14 h-1 bg-[#F0F0EE] rounded-full mt-1 overflow-hidden"><div className="h-full bg-[#EA580C] rounded-full" style={{ width:`${Math.round(done/j.checklist.length*100)}%` }} /></div>
                  </div>
                  <ChevronRight size={14} className="text-[#6B7280]" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Client View ──────────────────────────────────────────────────────────────

function ClientDashboard({ onSelectElevator }: { onSelectElevator: (e: Elevator, b: Building) => void }) {
  const clientBuildings = BUILDINGS.filter(b => b.clientId === "C01");
  return (
    <div className="space-y-5" style={{ fontFamily: "'Barlow', sans-serif" }}>
      <div><h2 className="text-2xl font-bold text-[#111827]">Mis Edificios</h2><p className="text-[#6B7280] text-sm">Estado de sus instalaciones y ascensores</p></div>
      {clientBuildings.map(b => (
        <div key={b.id} className="bg-white border border-[#E0E0DE] rounded-lg overflow-hidden">
          <div className="p-5 border-b border-[#F0F0EE]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: BUILDING_TYPE_COLORS[b.type]+"20", color: BUILDING_TYPE_COLORS[b.type] }}>{BUILDING_TYPE_ICONS[b.type]}</div>
              <div><div className="font-semibold text-[#111827]">{b.name}</div><div className="text-xs text-[#6B7280]">{b.address}</div></div>
            </div>
          </div>
          <div className="divide-y divide-[#F0F0EE]">
            {b.elevators.map(e => (
              <button key={e.id} onClick={() => onSelectElevator(e, b)} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#FAFAF9] text-left transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_ELV[e.status].dot}`} />
                <div className="flex-1"><span className="font-mono text-sm font-semibold text-[#111827]">{e.id}</span><span className="text-xs text-[#6B7280] ml-3">{e.brand} {e.model}</span></div>
                <span className={`text-xs font-mono ${STATUS_ELV[e.status].color}`}>{STATUS_ELV[e.status].label}</span>
                <ChevronRight size={13} className="text-[#6B7280]" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<{ role: Role; name: string } | null>(null);
  const [view, setView] = useState("dashboard");
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [emergencies] = useState<Emergency[]>(EMERGENCIES);
  const [messages] = useState<Message[]>(MESSAGES);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedElevator, setSelectedElevator] = useState<{ elevator: Elevator; building: Building } | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  function handleLogin(role: Role, name: string) {
    setSession({ role, name });
    setView(role === "technician" ? "my-jobs" : "dashboard");
  }

  function handleLogout() { setSession(null); setView("dashboard"); setSelectedJob(null); setSelectedElevator(null); }

  function handleNavigate(v: string) { setView(v); setSelectedJob(null); setSelectedElevator(null); }

  function handleUpdateJob(updated: Job) {
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    setSelectedJob(updated);
  }

  function handleSelectElevator(elevator: Elevator, building: Building) {
    setSelectedElevator({ elevator, building });
    setView("elevators");
  }

  if (!session) return <LoginScreen onLogin={handleLogin} />;

  const activeEmergencies = emergencies.filter(e => e.status !== "resolved").length;
  const unread = messages.filter(m => !m.read).length;

  function renderContent() {
    const { role } = session!;

    if (selectedElevator && view === "elevators") {
      return <ElevatorDetail elevator={selectedElevator.elevator} building={selectedElevator.building} onBack={() => setSelectedElevator(null)} />;
    }

    if (role === "operator") {
      switch (view) {
        case "dashboard": return <OperatorDashboard jobs={jobs} emergencies={emergencies} />;
        case "map": return <MapView role={role} />;
        case "calendar": return <CalendarView jobs={jobs} onUpdateJobs={setJobs} />;
        case "schedule": return <ScheduleView jobs={jobs} onUpdateJobs={setJobs} />;
        case "elevators": return <ElevatorBrowser onSelectElevator={handleSelectElevator} />;
        case "emergency": return <EmergencyView emergencies={emergencies} role={role} />;
        case "technicians": return <TechniciansView jobs={jobs} />;
        case "messages": return <MessagesView messages={messages} role={role} userName={session!.name} />;
      }
    }

    if (role === "technician") {
      if (view === "my-jobs") {
        if (selectedJob) return <TechJobDetail job={selectedJob} onBack={() => setSelectedJob(null)} onUpdateJob={handleUpdateJob} />;
        return <TechMyJobs jobs={jobs} onSelect={setSelectedJob} />;
      }
      switch (view) {
        case "map": return <MapView role={role} />;
        case "emergency": return <EmergencyView emergencies={emergencies} role={role} />;
        case "messages": return <MessagesView messages={messages} role={role} userName={session!.name} />;
      }
    }

    if (role === "client") {
      switch (view) {
        case "dashboard": return <ClientDashboard onSelectElevator={handleSelectElevator} />;
        case "elevators": return <ElevatorBrowser onSelectElevator={handleSelectElevator} />;
        case "messages": return <MessagesView messages={messages} role={role} userName={session!.name} />;
      }
    }

    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F4F4F2", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar role={session.role} userName={session.name} activeView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar isOnline={isOnline} onToggleOnline={() => setIsOnline(v => !v)} emergencyCount={activeEmergencies} unreadCount={unread} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-8">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
}
