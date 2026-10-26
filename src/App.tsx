import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity, AlertTriangle, BedDouble, Brain, HeartPulse, RefreshCw, Stethoscope, Users,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { configured, supabase } from './lib/supabase';
import { useView } from './lib/useView';
import AdmitForm from './AdmitForm';
import type {
  AlertRow, BedRow, HospitalForecast, NoNurseRow, NurseRow, PatientRow, QueueRow, WardForecast, WardOcc,
} from './lib/types';

type Tab = 'overview' | 'beds' | 'patients' | 'nurses' | 'alerts' | 'forecast';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity size={16} /> },
  { id: 'beds', label: 'Rooms & Beds', icon: <BedDouble size={16} /> },
  { id: 'patients', label: 'Patients', icon: <Users size={16} /> },
  { id: 'nurses', label: 'Nurses', icon: <Stethoscope size={16} /> },
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={16} /> },
  { id: 'forecast', label: 'AI Forecast', icon: <Brain size={16} /> },
];

const pctColor = (p: number) =>
  p >= 90 ? 'bg-red-500' : p >= 75 ? 'bg-amber-500' : 'bg-emerald-500';

const sevBadge: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  Serious: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  High: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Moderate: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Stable: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

function Badge({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${sevBadge[text] ?? 'bg-slate-700 text-slate-200 border-slate-600'}`}>
      {text}
    </span>
  );
}

const priorityStyle: Record<string, string> = {
  Immediate: 'bg-red-500/20 text-red-300 border-red-500/50',
  Urgent: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
  'Semi-urgent': 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  Routine: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
};

function Priority({ text }: { text: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${priorityStyle[text] ?? 'border-slate-600 bg-slate-700 text-slate-200'}`}>
      {text}
    </span>
  );
}

function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900 p-4 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>}
      {children}
    </section>
  );
}

function Status({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) {
    return (
      <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
        Could not load data: {error}
      </p>
    );
  }
  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  return null;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
            {head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

/* ------------------------------ Overview ------------------------------ */
function Overview() {
  const wards = useView<WardOcc>('v_ward_occupancy', 'ward_id');
  const alerts = useView<AlertRow>('v_open_alerts');
  const patients = useView<PatientRow>('v_current_patients');
  const noNurse = useView<NoNurseRow>('v_patients_without_nurse');
  const queue = useView<QueueRow>('v_patient_queue', 'queue_position');

  const total = wards.data.reduce((s, w) => s + w.total_beds, 0);
  const occ = wards.data.reduce((s, w) => s + w.occupied_beds, 0);
  const stats = [
    { label: 'Bed occupancy', value: total ? `${Math.round((100 * occ) / total)}%` : '–', sub: `${occ} of ${total} beds` },
    { label: 'Current patients', value: patients.data.length, sub: 'admitted now' },
    { label: 'Open alerts', value: alerts.data.length, sub: 'need attention' },
    { label: 'Patients without nurse', value: noNurse.data.length, sub: 'today' },
  ];

  return (
    <div className="space-y-4">
      <Status loading={wards.loading} error={wards.error} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-xs uppercase text-slate-400">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold">{s.value}</p>
            <p className="text-xs text-slate-500">{s.sub}</p>
          </Card>
        ))}
      </div>
      <Card title="Attend first (priority queue)">
        {queue.data.length === 0 && <Empty text="No patients in the queue." />}
        <ol className="space-y-2">
          {queue.data.slice(0, 5).map((q) => (
            <li key={q.admission_id} className="flex items-center gap-3 rounded-lg border border-slate-800 p-2 text-sm">
              <span className="w-6 text-center font-semibold text-slate-400">{q.queue_position}</span>
              <span className="flex-1">
                <b>{q.patient_name}</b>
                <span className="text-slate-400"> · {q.diagnosis}</span>
                <span className="block text-xs text-slate-500">{q.ward_name} · Room {q.room_number} · Bed {q.bed_number} · {q.doctor_name}</span>
              </span>
              <Priority text={q.priority} />
            </li>
          ))}
        </ol>
      </Card>
      <Card title="Occupancy by ward">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wards.data}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="ward_name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Bar dataKey="occupancy_pct" name="Occupancy %" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {wards.data.map((w) => (
          <Card key={w.ward_id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{w.ward_name}</p>
                <p className="text-xs text-slate-400">{w.department} · {w.ward_type}</p>
              </div>
              <span className="text-lg font-semibold">{Math.round(w.occupancy_pct)}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded bg-slate-800">
              <div className={`h-full ${pctColor(w.occupancy_pct)}`} style={{ width: `${w.occupancy_pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {w.occupied_beds} occupied · {w.available_beds} available · {w.total_beds} total
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- Rooms & Beds ---------------------------- */
const bedStyle: Record<string, string> = {
  occupied: 'border-red-500/50 bg-red-500/10',
  available: 'border-emerald-500/50 bg-emerald-500/10',
  cleaning: 'border-amber-500/50 bg-amber-500/10',
};

function Beds() {
  const { data, loading, error } = useView<BedRow>('v_bed_map');
  const wards = Array.from(new Map(data.map((b) => [b.ward_id, b.ward_name])).entries());

  return (
    <div className="space-y-4">
      <Status loading={loading} error={error} />
      <div className="flex gap-4 text-xs text-slate-400">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Available</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Occupied</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Cleaning</span>
      </div>
      {wards.map(([wardId, wardName]) => {
        const beds = data.filter((b) => b.ward_id === wardId);
        const rooms = Array.from(new Set(beds.map((b) => b.room_number)));
        return (
          <Card key={wardId} title={wardName}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => {
                const rb = beds.filter((b) => b.room_number === room);
                return (
                  <div key={room} className="rounded-lg border border-slate-800 p-3">
                    <p className="mb-2 text-sm font-medium">
                      Room {room} <span className="text-xs text-slate-500">· {rb[0].room_type}</span>
                    </p>
                    <div className="space-y-2">
                      {rb.map((b) => (
                        <div key={b.bed_id} className={`rounded-md border p-2 text-xs ${bedStyle[b.bed_status] ?? 'border-slate-700'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Bed {b.bed_number}</span>
                            <span className="capitalize text-slate-400">{b.bed_status}</span>
                          </div>
                          {b.patient_name && (
                            <div className="mt-1 flex items-center justify-between">
                              <span>{b.patient_name}</span>
                              <Badge text={b.severity} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------ Patients ------------------------------ */
function Patients() {
  const { data, loading, error, reload } = useView<QueueRow>('v_patient_queue', 'queue_position');
  const [adding, setAdding] = useState(false);

  return (
    <Card title="Patient queue: most critical first">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Ordered by severity, then by AI triage score, then by who has waited longest.
        </p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400">
            + Admit patient
          </button>
        )}
      </div>
      {adding && (
        <AdmitForm
          onCancel={() => setAdding(false)}
          onDone={() => { setAdding(false); reload(); }}
        />
      )}
      <Status loading={loading} error={error} />
      {!loading && !error && data.length === 0 && <Empty text="No patients admitted." />}
      {data.length > 0 && (
        <Table head={['#', 'Priority', 'Patient', 'Age', 'Ward', 'Room', 'Bed', 'Doctor', 'Diagnosis', 'AI score', 'Days']}>
          {data.map((p) => (
            <tr key={p.admission_id}>
              <td className="px-3 py-2 font-semibold text-slate-400">{p.queue_position}</td>
              <td className="px-3 py-2"><Priority text={p.priority} /></td>
              <td className="px-3 py-2 font-medium">{p.patient_name}</td>
              <td className="px-3 py-2">{p.age} {p.gender}</td>
              <td className="px-3 py-2">{p.ward_name}</td>
              <td className="px-3 py-2">{p.room_number}</td>
              <td className="px-3 py-2">{p.bed_number}</td>
              <td className="px-3 py-2">{p.doctor_name}</td>
              <td className="px-3 py-2">{p.diagnosis}</td>
              <td className="px-3 py-2">{p.total_score ?? '–'}</td>
              <td className="px-3 py-2">{p.days_admitted}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* ------------------------------- Nurses ------------------------------- */
function Nurses() {
  const work = useView<NurseRow>('v_nurse_workload', 'nurse_name');
  const gap = useView<NoNurseRow>('v_patients_without_nurse', 'admission_id');
  const today = new Date().toISOString().slice(0, 10);
  const rows = work.data.filter((r) => r.shift_date === today);

  return (
    <div className="space-y-4">
      <Card title="Nurse workload (patients per nurse per shift, max 6)">
        <Status loading={work.loading} error={work.error} />
        {!work.loading && !work.error && rows.length === 0 && (
          <Empty text="No nurse assignments yet. In Supabase run: CALL seed_todays_shifts();" />
        )}
        {rows.length > 0 && (
          <Table head={['Date', 'Shift', 'Nurse', 'Ward', 'Patients', 'Load']}>
            {rows.map((r) => (
              <tr key={`${r.nurse_id}-${r.shift_date}-${r.shift_type}`}>
                <td className="px-3 py-2">{r.shift_date}</td>
                <td className="px-3 py-2">{r.shift_type}</td>
                <td className="px-3 py-2 font-medium">{r.nurse_name}</td>
                <td className="px-3 py-2">{r.ward_name}</td>
                <td className="px-3 py-2">{r.patients}</td>
                <td className="w-40 px-3 py-2">
                  <div className="h-2 overflow-hidden rounded bg-slate-800">
                    <div className={`h-full ${pctColor((100 * r.patients) / 6)}`} style={{ width: `${Math.min(100, (100 * r.patients) / 6)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title="Patients with no nurse today">
        <Status loading={gap.loading} error={gap.error} />
        {!gap.loading && !gap.error && gap.data.length === 0 && <Empty text="Every patient has a nurse." />}
        {gap.data.length > 0 && (
          <Table head={['Patient', 'Ward', 'Room', 'Bed', 'Severity']}>
            {gap.data.map((p) => (
              <tr key={p.admission_id}>
                <td className="px-3 py-2 font-medium">{p.patient_name}</td>
                <td className="px-3 py-2">{p.ward_name}</td>
                <td className="px-3 py-2">{p.room_number}</td>
                <td className="px-3 py-2">{p.bed_number}</td>
                <td className="px-3 py-2"><Badge text={p.severity} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------- Alerts ------------------------------- */
function Alerts() {
  const { data, loading, error } = useView<AlertRow>('v_open_alerts');
  return (
    <Card title="Open alerts">
      <Status loading={loading} error={error} />
      {!loading && !error && data.length === 0 && <Empty text="No open alerts." />}
      <ul className="space-y-2">
        {data.map((a) => (
          <li key={a.alert_id} className="flex items-start gap-3 rounded-lg border border-slate-800 p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm">{a.message}</p>
              <p className="text-xs text-slate-400">{a.ward_name} · {a.alert_type} · {new Date(a.created_at).toLocaleString()}</p>
            </div>
            <Badge text={a.priority} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------ Forecast ------------------------------ */
const outlookStyle: Record<string, string> = {
  'High pressure': 'bg-red-500/20 text-red-300 border-red-500/50',
  Busy: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  Comfortable: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
};
const riskText: Record<string, string> = {
  'Overflow risk': 'text-red-300', Busy: 'text-amber-300', Comfortable: 'text-emerald-300',
};
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function Forecast() {
  const hosp = useView<HospitalForecast>('v_forecast_hospital', 'forecast_date');
  const wards = useView<WardForecast>('v_forecast_wards', 'ward_id');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const triedAuto = useRef(false);

  async function recalc() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc('refresh_forecast');
    if (error) setMsg(error.message);
    else { await hosp.reload(); await wards.reload(); }
    setBusy(false);
  }

  // first visit (or old forecasts expired): build the next 3 days automatically
  useEffect(() => {
    if (!hosp.loading && !hosp.error && hosp.data.length < 3 && !triedAuto.current) {
      triedAuto.current = true;
      recalc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hosp.loading, hosp.error, hosp.data.length]);

  const names = Array.from(new Set(wards.data.map((w) => w.ward_name)));
  const colors = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#a78bfa', '#fb923c'];
  const chart = [
    { day: 'Today', ...Object.fromEntries(names.map((n) => [n, wards.data.find((w) => w.ward_name === n)?.current_pct ?? 0])) },
    ...hosp.data.map((h) => ({
      day: dayLabel(h.forecast_date),
      ...Object.fromEntries(names.map((n) => [n, wards.data.find((w) => w.ward_name === n && w.forecast_date === h.forecast_date)?.predicted_pct ?? 0])),
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">What the hospital will look like over the next 3 days.</p>
        <button onClick={recalc} disabled={busy} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> {busy ? 'Calculating…' : 'Recalculate forecast'}
        </button>
      </div>
      <Status loading={hosp.loading} error={hosp.error ?? wards.error ?? msg} />

      <div className="grid gap-3 md:grid-cols-3">
        {hosp.data.map((h) => (
          <Card key={h.forecast_date}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-slate-400">Day {h.day_no}</p>
                <p className="font-medium">{dayLabel(h.forecast_date)}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${outlookStyle[h.outlook]}`}>{h.outlook}</span>
            </div>
            <p className="mt-3 text-3xl font-semibold">{Math.round(h.occupancy_pct)}%</p>
            <p className="text-xs text-slate-500">{h.occupied_beds} of {h.total_beds} beds occupied</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Free beds</dt><dd>{h.free_beds}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Wards at overflow risk</dt><dd className={h.wards_overflow > 0 ? 'text-red-300' : ''}>{h.wards_overflow}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Wards busy</dt><dd>{h.wards_busy}</dd></div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Nurses needed / rostered</dt>
                <dd className={h.nurses_needed > h.nurses_rostered ? 'text-red-300' : ''}>{h.nurses_needed} / {h.nurses_rostered}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      {hosp.data.length > 0 && (
        <Card title="Occupancy by ward: today and the next 3 days">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                <Legend />
                {names.map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n} stroke={colors[i % colors.length]} strokeWidth={2} dot />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {wards.data.length > 0 && (
        <Card title="Ward by ward">
          <Table head={['Ward', 'Today', ...hosp.data.map((h) => dayLabel(h.forecast_date)), 'Nurses (need / rostered)']}>
            {names.map((n) => {
              const rows = wards.data.filter((w) => w.ward_name === n).sort((a, b) => a.day_no - b.day_no);
              const first = rows[0];
              return (
                <tr key={n}>
                  <td className="px-3 py-2 font-medium">{n}</td>
                  <td className="px-3 py-2">{Math.round(first.current_pct)}%</td>
                  {rows.map((r) => (
                    <td key={r.forecast_date} className={`px-3 py-2 ${riskText[r.risk]}`}>
                      {Math.round(r.predicted_pct)}% <span className="text-xs text-slate-500">({r.predicted_occupied}/{r.total_beds})</span>
                    </td>
                  ))}
                  <td className={`px-3 py-2 ${first.nurses_needed > first.nurses_rostered ? 'text-red-300' : ''}`}>
                    {first.nurses_needed} / {first.nurses_rostered}
                  </td>
                </tr>
              );
            })}
          </Table>
          <p className="mt-3 text-xs text-slate-500">
            Method: each day, occupied beds change by the expected arrivals (recent 14-day rate, balanced with the ward's current load) minus expected discharges (occupied beds divided by the average length of stay). Red means 90% or more (overflow risk), amber 75% or more. Nurses needed assumes 1 nurse for every 6 patients and today's roster.
          </p>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------- App --------------------------------- */
export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [version, setVersion] = useState(0); // changing the key reloads the active page

  if (!configured) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="mb-3 text-xl font-semibold">Supabase is not configured</h1>
        <p className="text-sm text-slate-300">
          Create a file named <code className="rounded bg-slate-800 px-1">.env</code> next to <code className="rounded bg-slate-800 px-1">package.json</code> with:
        </p>
        <pre className="mt-3 rounded-lg bg-slate-900 p-3 text-xs">{`VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key`}</pre>
        <p className="mt-3 text-sm text-slate-300">Then stop the app (Ctrl+C) and run <code className="rounded bg-slate-800 px-1">npm run dev</code> again.</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="text-sky-400" />
            <h1 className="text-lg font-semibold">AI Hospital Command Center</h1>
          </div>
          <button
            onClick={() => setVersion((v) => v + 1)}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                tab === t.id ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </nav>
      </header>
      <main key={`${tab}-${version}`} className="mx-auto max-w-7xl p-4">
        {tab === 'overview' && <Overview />}
        {tab === 'beds' && <Beds />}
        {tab === 'patients' && <Patients />}
        {tab === 'nurses' && <Nurses />}
        {tab === 'alerts' && <Alerts />}
        {tab === 'forecast' && <Forecast />}
      </main>
    </div>
  );
}
