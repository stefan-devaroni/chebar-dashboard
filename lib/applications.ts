// Job applications from the careers page on chebararuba.com, shared by the public API
// (validation) and the Applicants tab in the dashboard.

export const POSITIONS = ['Server', 'Bartender', 'Kitchen', 'Other'] as const;
export const AVAILABILITY = ['Full-time', 'Part-time', 'Either'] as const;
export const SHIFTS = ['Mornings', 'Nights', 'Weekends'] as const;
export const LANGUAGES = ['English', 'Papiamento', 'Spanish', 'Dutch'] as const;

export type ApplicationStatus = 'new' | 'contacted' | 'interview' | 'later' | 'hired' | 'not_a_fit';
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interview: 'Interview',
  later: 'Keep for later',
  hired: 'Hired',
  not_a_fit: 'Not a fit',
};
export const STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

export interface JobApplication {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  positions: string[];
  adult: boolean | null;
  availability: string | null;
  shifts: string[];
  start_date: string | null;
  languages: string[];
  experience: string | null;
  about: string | null;
  cv_path: string | null;
  cv_name: string | null;
  cv_size: number | null;
  status: ApplicationStatus;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

// Never the hashed IP
export const APPLICATION_COLUMNS =
  'id, created_at, name, email, phone, positions, adult, availability, shifts, start_date, languages, experience, about, cv_path, cv_name, cv_size, status, notes, updated_at, updated_by';

// Netlify functions accept requests up to about 6 MB, so CVs stay under 4 MB
export const MAX_CV_BYTES = 4 * 1024 * 1024;
const CV_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'heic'];

export function cvExtension(fileName: string): string | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  return CV_EXTENSIONS.includes(ext) ? ext : null;
}

type Parsed = { ok: true; value: Omit<JobApplication, 'id' | 'created_at' | 'cv_path' | 'cv_name' | 'cv_size' | 'status' | 'notes' | 'updated_at' | 'updated_by'> } | { ok: false; error: string };

const text = (v: FormDataEntryValue | null, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = <T extends string>(values: FormDataEntryValue[], allowed: readonly T[]) =>
  Array.from(new Set(values.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v))));

export function parseApplication(form: FormData): Parsed {
  const name = text(form.get('name'), 100);
  const email = text(form.get('email'), 200).toLowerCase();
  const phone = text(form.get('phone'), 40);
  const positions = pick(form.getAll('positions'), POSITIONS);
  const adult = text(form.get('adult'), 3);
  const availability = text(form.get('availability'), 20);
  const startDate = text(form.get('start_date'), 10);
  const experience = text(form.get('experience'), 3000);

  if (name.length < 2) return { ok: false, error: 'Please enter your full name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if ((phone.match(/\d/g) ?? []).length < 7) return { ok: false, error: 'Please enter a phone or WhatsApp number.' };
  if (positions.length === 0) return { ok: false, error: 'Please choose at least one position.' };
  if (adult !== 'yes' && adult !== 'no') return { ok: false, error: 'Please tell us if you are 18 or older.' };
  if (!experience) return { ok: false, error: 'Please tell us about your work experience (or that you have none yet).' };
  if (form.get('consent') !== 'yes') return { ok: false, error: 'Please agree that we can keep your application on file.' };

  return {
    ok: true,
    value: {
      name,
      email,
      phone,
      positions,
      adult: adult === 'yes',
      availability: (AVAILABILITY as readonly string[]).includes(availability) ? availability : null,
      shifts: pick(form.getAll('shifts'), SHIFTS),
      start_date: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
      languages: pick(form.getAll('languages'), LANGUAGES),
      experience,
      about: text(form.get('about'), 3000) || null,
    },
  };
}

// "+297 699 1696" -> "2976991696" for a WhatsApp link (Aruban 7-digit numbers get the 297 prefix)
export function whatsappNumber(phone: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.length === 7 ? `297${digits}` : digits;
}
