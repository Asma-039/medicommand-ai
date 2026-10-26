import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useView } from './lib/useView';
import type { FreeBed, NurseDuty, SymptomRow, TriageResult } from './lib/types';

const sevStyle: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-300 border-red-500/50',
  High: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
  Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  Low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
};

const input =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label} {hint && <span className="text-slate-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

// allowed ranges (the database checks the same limits)
const RANGES: Record<string, [number, number]> = {
  hr: [20, 250], sys: [40, 300], dia: [20, 200], spo2: [50, 100], temp: [30, 45], rr: [4, 60],
};

export default function AdmitForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const symptoms = useView<SymptomRow>('symptom_catalog', 'label');
  const freeBeds = useView<FreeBed>('v_free_beds');
  const nurses = useView<NurseDuty>('v_nurses_on_duty', 'nurse_name');

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('M');
  const [blood, setBlood] = useState('');
  const [phone, setPhone] = useState('');
  const [v, setV] = useState({ hr: '', sys: '', dia: '', spo2: '', temp: '', rr: '' });
  const [alertLevel, setAlertLevel] = useState('Alert');
  const [picked, setPicked] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [bedId, setBedId] = useState('');
  const [nurseId, setNurseId] = useState('');

  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [triageBusy, setTriageBusy] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<TriageResult | null>(null);

  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const outOfRange = Object.entries(v).filter(([k, s]) => {
    const n = num(s);
    return !Number.isNaN(n) && (n < RANGES[k][0] || n > RANGES[k][1]);
  });
  const vitalsReady =
    Object.values(v).every((s) => s.trim() !== '' && !Number.isNaN(num(s))) &&
    outOfRange.length === 0 &&
    num(v.dia) < num(v.sys);
  const ready = vitalsReady && dob !== '';

  // live AI triage preview: recalculated shortly after any change
  useEffect(() => {
    if (!ready) {
      setTriage(null);
      return;
    }
    let cancelled = false;
    setTriageBusy(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('triage_preview', {
        p_dob: dob, p_heart_rate: num(v.hr), p_systolic_bp: num(v.sys), p_diastolic_bp: num(v.dia),
        p_spo2: num(v.spo2), p_temp_c: num(v.temp), p_resp_rate: num(v.rr),
        p_alert_level: alertLevel, p_symptoms: picked,
      });
      if (cancelled) return;
      setTriageBusy(false);
      if (error) { setTriageError(error.message); setTriage(null); }
      else { setTriageError(null); setTriage(data as TriageResult); }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dob, v, alertLevel, picked]);

  // free beds: the ward of the recommended department comes first
  const orderedBeds = useMemo(() => {
    const rec = triage?.department_id;
    return [...freeBeds.data].sort((a, b) => {
      const ra = a.department_id === rec ? 0 : 1;
      const rb = b.department_id === rec ? 0 : 1;
      return ra - rb || a.ward_id - b.ward_id || a.room_number.localeCompare(b.room_number) || a.bed_number.localeCompare(b.bed_number);
    });
  }, [freeBeds.data, triage]);

  const selectedBed = freeBeds.data.find((b) => String(b.bed_id) === bedId);
  const nurseChoices = nurses.data.filter((n) => selectedBed && n.ward_id === selectedBed.ward_id);

  const toggle = (code: string) =>
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));

  const canSubmit = name.trim() !== '' && ready && bedId !== '' && !saving;

  async function submit() {
    setSaving(true);
    setError(null);
    const { data, error } = await supabase.rpc('admit_with_triage', {
      p_full_name: name, p_dob: dob, p_gender: gender, p_blood_group: blood, p_phone: phone,
      p_heart_rate: num(v.hr), p_systolic_bp: num(v.sys), p_diastolic_bp: num(v.dia),
      p_spo2: num(v.spo2), p_temp_c: num(v.temp), p_resp_rate: num(v.rr),
      p_alert_level: alertLevel, p_symptoms: picked, p_bed_id: Number(bedId),
      p_nurse_id: nurseId === '' ? null : Number(nurseId), p_notes: notes,
    });
    setSaving(false);
    if (error) setError(error.message);
    else setDone(data as TriageResult);
  }

  if (done) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <p className="font-medium text-emerald-300">Patient admitted</p>
        <p className="mt-1 text-sm text-slate-200">
          Severity <b>{done.severity}</b> (score {done.score}) · {done.department} · <b>{done.doctor_name}</b> assigned automatically.
        </p>
        <button onClick={onDone} className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* column 1: patient details */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">1. Patient</h3>
          <Field label="Full name"><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth"><input type="date" className={input} value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} /></Field>
            <Field label="Gender">
              <select className={input} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
              </select>
            </Field>
            <Field label="Blood group" hint="(optional)">
              <select className={input} value={blood} onChange={(e) => setBlood(e.target.value)}>
                <option value="">Unknown</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Phone" hint="(optional)"><input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>
          <Field label="Notes" hint="(optional, otherwise the symptoms are used)">
            <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for admission" />
          </Field>
        </div>

        {/* column 2: vitals and symptoms */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">2. Vital signs and symptoms</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Heart rate" hint="bpm"><input inputMode="numeric" className={input} value={v.hr} onChange={(e) => setV({ ...v, hr: e.target.value })} placeholder="e.g. 80" /></Field>
            <Field label="Oxygen (SpO2)" hint="%"><input inputMode="numeric" className={input} value={v.spo2} onChange={(e) => setV({ ...v, spo2: e.target.value })} placeholder="e.g. 98" /></Field>
            <Field label="BP systolic" hint="mmHg"><input inputMode="numeric" className={input} value={v.sys} onChange={(e) => setV({ ...v, sys: e.target.value })} placeholder="e.g. 120" /></Field>
            <Field label="BP diastolic" hint="mmHg"><input inputMode="numeric" className={input} value={v.dia} onChange={(e) => setV({ ...v, dia: e.target.value })} placeholder="e.g. 80" /></Field>
            <Field label="Temperature" hint="°C"><input inputMode="decimal" className={input} value={v.temp} onChange={(e) => setV({ ...v, temp: e.target.value })} placeholder="e.g. 37.0" /></Field>
            <Field label="Breathing rate" hint="/min"><input inputMode="numeric" className={input} value={v.rr} onChange={(e) => setV({ ...v, rr: e.target.value })} placeholder="e.g. 16" /></Field>
          </div>
          {outOfRange.length > 0 && (
            <p className="text-xs text-amber-400">Some values are outside the possible range. Please check them.</p>
          )}
          {v.sys && v.dia && num(v.dia) >= num(v.sys) && (
            <p className="text-xs text-amber-400">Diastolic pressure must be lower than systolic.</p>
          )}
          <Field label="Consciousness">
            <select className={input} value={alertLevel} onChange={(e) => setAlertLevel(e.target.value)}>
              <option>Alert</option><option>Drowsy or confused</option><option>Unresponsive</option>
            </select>
          </Field>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-400">Symptoms (tick all that apply)</span>
            <div className="flex flex-wrap gap-2">
              {symptoms.data.map((s) => (
                <button
                  type="button" key={s.symptom_code} onClick={() => toggle(s.symptom_code)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    picked.includes(s.symptom_code)
                      ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* column 3: AI result, bed, nurse */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-300"><Brain size={15} /> 3. AI triage result</h3>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
            {!ready && <p className="text-slate-500">Enter the date of birth and all six vital signs to see the result.</p>}
            {ready && triageBusy && !triage && <p className="flex items-center gap-2 text-slate-400"><Loader2 size={14} className="animate-spin" /> Calculating…</p>}
            {triageError && <p className="text-red-300">{triageError}</p>}
            {triage && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-3 py-0.5 text-sm font-semibold ${sevStyle[triage.severity]}`}>{triage.severity}</span>
                  <span className="text-slate-400">score {triage.score}</span>
                </div>
                <p><span className="text-slate-400">Department:</span> {triage.department}</p>
                <p><span className="text-slate-400">Doctor (automatic):</span> <b>{triage.doctor_name}</b></p>
                {triage.reasons.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-400">
                    {triage.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                )}
                {triage.reasons.length === 0 && <p className="text-xs text-slate-500">All vital signs are normal and no symptoms were selected.</p>}
              </div>
            )}
          </div>

          <Field label="Bed" hint={triage ? `(★ = recommended ward: ${triage.department})` : undefined}>
            <select className={input} value={bedId} onChange={(e) => { setBedId(e.target.value); setNurseId(''); }}>
              <option value="">Select a free bed</option>
              {orderedBeds.map((b) => (
                <option key={b.bed_id} value={b.bed_id}>
                  {b.department_id === triage?.department_id ? '★ ' : ''}{b.ward_name} · Room {b.room_number} · Bed {b.bed_number}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nurse" hint="(your choice, optional)">
            <select className={input} value={nurseId} onChange={(e) => setNurseId(e.target.value)} disabled={!selectedBed}>
              <option value="">{selectedBed ? 'Assign later' : 'Select a bed first'}</option>
              {nurseChoices.map((n) => (
                <option key={`${n.nurse_id}-${n.shift_type}`} value={n.nurse_id}>
                  {n.nurse_name} · {n.shift_type} shift · {n.current_patients} patients
                </option>
              ))}
            </select>
            {selectedBed && nurseChoices.length === 0 && (
              <span className="mt-1 block text-xs text-amber-400">No nurse is on duty in this ward today. You can assign one later.</span>
            )}
          </Field>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={submit} disabled={!canSubmit} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? 'Admitting…' : 'Admit patient'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Cancel</button>
      </div>
    </div>
  );
}
