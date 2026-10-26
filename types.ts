export interface WardOcc {
  ward_id: number; ward_name: string; ward_type: string; department: string;
  total_beds: number; occupied_beds: number; available_beds: number; occupancy_pct: number;
}
export interface BedRow {
  ward_id: number; ward_name: string; room_number: string; room_type: string;
  bed_id: number; bed_number: string; bed_status: string;
  patient_name: string | null; severity: string | null;
}
export interface PatientRow {
  admission_id: number; patient_name: string; age: number; gender: string;
  ward_name: string; room_number: string; bed_number: string; doctor_name: string;
  diagnosis: string; severity: string; days_admitted: number;
}
export interface AlertRow {
  alert_id: number; ward_name: string; alert_type: string; priority: string;
  message: string; created_at: string;
}
export interface ForecastRow {
  ward_id: number; ward_name: string; forecast_date: string;
  predicted_occupancy_pct: number; model_name: string;
  current_occupancy_pct: number; expected_change: number;
}
export interface NurseRow {
  shift_date: string; shift_type: string; nurse_id: number; nurse_name: string;
  ward_name: string; patients: number;
}
export interface NoNurseRow {
  admission_id: number; patient_name: string; ward_name: string;
  room_number: string; bed_number: string; severity: string;
}
export interface SymptomRow {
  symptom_code: string; label: string; points: number; department_id: number;
}
export interface FreeBed {
  bed_id: number; bed_number: string; room_number: string; room_type: string;
  ward_id: number; ward_name: string; ward_type: string; department_id: number;
}
export interface NurseDuty {
  nurse_id: number; nurse_name: string; ward_id: number; ward_name: string;
  shift_type: string; current_patients: number;
}
export interface TriageLog {
  admission_id: number; total_score: number; severity: string; department: string; symptoms: string;
}
export interface TriageResult {
  score: number; severity: string; department_id: number; department: string;
  reasons: string[]; doctor_id: number; doctor_name: string;
}
export interface QueueRow {
  queue_position: number; admission_id: number; patient_name: string; age: number; gender: string;
  ward_name: string; room_number: string; bed_number: string; doctor_name: string;
  diagnosis: string; severity: string; total_score: number | null; priority: string;
  admitted_at: string; days_admitted: number;
}
export interface WardForecast {
  ward_id: number; ward_name: string; forecast_date: string; day_no: number; total_beds: number;
  predicted_pct: number; predicted_occupied: number; predicted_free: number;
  current_pct: number; change_pct: number; risk: string;
  nurses_needed: number; nurses_rostered: number;
}
export interface HospitalForecast {
  forecast_date: string; day_no: number; total_beds: number; occupied_beds: number;
  free_beds: number; occupancy_pct: number; wards_overflow: number; wards_busy: number;
  nurses_needed: number; nurses_rostered: number; outlook: string;
}
