export type FieldType = "string" | "number" | "boolean" | "ids" | "strings";

export type BodyField = {
  path: string[];
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  width?: number;
};

// ─── Assembly helpers ─────────────────────────────────────────────────────────

function setDeep(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[path.at(-1)!] = value;
}

function coerceValue(raw: string, type: FieldType): unknown {
  const s = raw.trim();
  if (!s) return undefined;
  switch (type) {
    case "number":  { const n = Number(s); return isNaN(n) ? undefined : n; }
    case "boolean": return s === "true" || s === "t" || s === "1" || s === "yes";
    case "ids":     { const ns = s.split(",").map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n)); return ns.length ? ns : undefined; }
    case "strings": { const ss = s.split(",").map(x => x.trim()).filter(Boolean); return ss.length ? ss : undefined; }
    default:        return s;
  }
}

export function assembleBody(
  fields: BodyField[],
  values: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const key = field.path.join(".");
    const value = coerceValue(values[key] ?? "", field.type);
    if (value !== undefined) setDeep(result, field.path, value);
  }
  return result;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

type BodySchema = Record<string, Record<string, BodyField[]>>;

const v2: BodySchema = {
  appointmentTypes: {
    create: [
      { path: ["appointment_type", "name"],             label: "Name",            type: "string",  required: true,  placeholder: "General Checkup",       width: 18 },
      { path: ["appointment_type", "minutes"],          label: "Duration (min)",  type: "number",  placeholder: "60",                                     width: 15 },
      { path: ["appointment_type", "bookable_online"],  label: "Bookable Online", type: "boolean", placeholder: "true / false",                           width: 16 },
      { path: ["appointment_type", "parent_type"],      label: "Parent Type",     type: "string",  placeholder: "institution / location",                 width: 22 },
      { path: ["appointment_type", "parent_id"],        label: "Parent ID",       type: "number",  placeholder: "123",                                    width: 11 },
    ],
    update: [
      { path: ["appointment_type", "name"],             label: "Name",            type: "string",  placeholder: "General Checkup",      width: 18 },
      { path: ["appointment_type", "minutes"],          label: "Duration (min)",  type: "number",  placeholder: "60",                   width: 15 },
      { path: ["appointment_type", "bookable_online"],  label: "Bookable Online", type: "boolean", placeholder: "true / false",         width: 16 },
    ],
  },
  appointments: {
    create: [
      { path: ["appt", "patient_id"],              label: "Patient ID",     type: "number",  required: true,  placeholder: "456",                 width: 13 },
      { path: ["appt", "provider_id"],             label: "Provider ID",    type: "number",  required: true,  placeholder: "789",                 width: 14 },
      { path: ["appt", "start_time"],              label: "Start Time",     type: "string",  required: true,  placeholder: "2026-05-20T09:00:00", width: 22 },
      { path: ["appt", "end_time"],                label: "End Time",       type: "string",  placeholder: "2026-05-20T10:00:00",                   width: 22 },
      { path: ["appt", "appointment_type_id"],     label: "Appt Type ID",   type: "number",  placeholder: "1",                                     width: 14 },
      { path: ["appt", "operatory_id"],            label: "Operatory ID",   type: "number",  placeholder: "2",                                     width: 13 },
      { path: ["appt", "note"],                    label: "Note",           type: "string",  placeholder: "Patient note…" },
      { path: ["appt", "unavailable"],             label: "Unavailable",    type: "boolean", placeholder: "true / false",                          width: 13 },
      { path: ["appt", "is_guardian"],             label: "Is Guardian",    type: "boolean", placeholder: "true / false",                          width: 13 },
      { path: ["appt", "is_new_clients_patient"],  label: "New Patient",    type: "boolean", placeholder: "true / false",                          width: 13 },
      { path: ["appt", "referrer"],                label: "Referrer",       type: "string",  placeholder: "referrer",                              width: 12 },
      { path: ["appt", "descriptor_ids"],          label: "Descriptor IDs", type: "ids",     placeholder: "1,2,3",                                 width: 16 },
      { path: ["appointments_per_timeslot"],        label: "Appts/Slot",    type: "number",  placeholder: "1",                                     width: 12 },
    ],
    update: [
      { path: ["appt", "confirmed"], label: "Confirmed", type: "boolean", placeholder: "true / false", width: 13 },
      { path: ["appt", "cancelled"], label: "Cancelled", type: "boolean", placeholder: "true / false", width: 13 },
    ],
  },
  availabilities: {
    create: [
      { path: ["availability", "provider_id"],           label: "Provider ID",   type: "number",  required: true,  placeholder: "123",             width: 14 },
      { path: ["availability", "begin_time"],            label: "Begin Time",    type: "string",  required: true,  placeholder: "09:00",           width: 13 },
      { path: ["availability", "end_time"],              label: "End Time",      type: "string",  required: true,  placeholder: "17:00",           width: 12 },
      { path: ["availability", "operatory_id"],          label: "Operatory ID",  type: "number",  placeholder: "456",                              width: 13 },
      { path: ["availability", "appointment_type_ids"],  label: "Appt Type IDs", type: "ids",     placeholder: "1,2,3",                            width: 15 },
      { path: ["availability", "days"],                  label: "Days",          type: "strings", placeholder: "Monday,Tuesday,…" },
      { path: ["availability", "specific_date"],         label: "Specific Date", type: "string",  placeholder: "2026-05-20",                       width: 14 },
      { path: ["availability", "active"],                label: "Active",        type: "boolean", placeholder: "true / false",                     width: 10 },
    ],
    update: [
      { path: ["availability", "begin_time"],            label: "Begin Time",    type: "string",  placeholder: "09:00",        width: 12 },
      { path: ["availability", "end_time"],              label: "End Time",      type: "string",  placeholder: "17:00",        width: 12 },
      { path: ["availability", "operatory_id"],          label: "Operatory ID",  type: "number",  placeholder: "456",          width: 13 },
      { path: ["availability", "appointment_type_ids"],  label: "Appt Type IDs", type: "ids",     placeholder: "1,2,3",        width: 15 },
      { path: ["availability", "days"],                  label: "Days",          type: "strings", placeholder: "Monday,Tuesday,…" },
      { path: ["availability", "specific_date"],         label: "Specific Date", type: "string",  placeholder: "2026-05-20",   width: 14 },
      { path: ["availability", "active"],                label: "Active",        type: "boolean", placeholder: "true / false", width: 10 },
    ],
  },
  patients: {
    create: [
      { path: ["provider", "provider_id"],           label: "Provider ID",   type: "number",  required: true,  placeholder: "123",           width: 14 },
      { path: ["patient", "first_name"],             label: "First Name",    type: "string",  required: true,  placeholder: "Jane",          width: 13 },
      { path: ["patient", "last_name"],              label: "Last Name",     type: "string",  required: true,  placeholder: "Doe",           width: 13 },
      { path: ["patient", "email"],                  label: "Email",         type: "string",  required: true,  placeholder: "jane@…",        width: 18 },
      { path: ["patient", "bio", "date_of_birth"],   label: "Date of Birth", type: "string",  required: true,  placeholder: "1990-01-15",    width: 16 },
      { path: ["patient", "bio", "phone_number"],    label: "Phone",         type: "string",  required: true,  placeholder: "555-555-5555",  width: 14 },
      { path: ["patient", "bio", "gender"],          label: "Gender",        type: "string",  placeholder: "Male / Female / Other",          width: 20 },
      { path: ["patient", "bio", "street_address"],  label: "Street",        type: "string",  placeholder: "123 Main St" },
      { path: ["patient", "bio", "city"],            label: "City",          type: "string",  placeholder: "San Francisco",                  width: 15 },
      { path: ["patient", "bio", "state"],           label: "State",         type: "string",  placeholder: "CA",                             width: 8  },
      { path: ["patient", "bio", "zip_code"],        label: "Zip",           type: "string",  placeholder: "94105",                          width: 8  },
    ],
  },
  patientAlerts: {
    create: [
      { path: ["patient_alert", "note"], label: "Note", type: "string", required: true, placeholder: "Alert note…" },
    ],
    update: [
      { path: ["patient_alert", "disabled"], label: "Disabled", type: "boolean", placeholder: "true / false", width: 12 },
    ],
  },
  webhookEndpoints: {
    create: [
      { path: ["target_url"], label: "Target URL", type: "string",  required: true,  placeholder: "https://example.com/webhook" },
      { path: ["active"],     label: "Active",     type: "boolean", placeholder: "true / false", width: 10 },
    ],
    update: [
      { path: ["target_url"], label: "Target URL", type: "string",  placeholder: "https://example.com/webhook" },
      { path: ["active"],     label: "Active",     type: "boolean", placeholder: "true / false", width: 10 },
    ],
  },
  webhookSubscriptions: {
    create: [
      { path: ["resource_type"], label: "Resource Type", type: "string",  required: true,  placeholder: "Appointment / Patient / …", width: 22 },
      { path: ["event"],         label: "Event",         type: "string",  required: true,  placeholder: "CREATE / UPDATE / DELETE",  width: 22 },
      { path: ["active"],        label: "Active",        type: "boolean", placeholder: "true / false",                              width: 10 },
    ],
    update: [
      { path: ["new_endpoint_id"], label: "New Endpoint ID", type: "number",  placeholder: "123",          width: 17 },
      { path: ["active"],          label: "Active",          type: "boolean", placeholder: "true / false", width: 10 },
    ],
  },
};

const v2024: BodySchema = {
  adjustments: {
    create: [
      { path: ["adjustment", "patient_id"],          label: "Patient ID",   type: "number",  required: true,  placeholder: "123",   width: 13 },
      { path: ["adjustment", "amount"],              label: "Amount",       type: "number",  required: true,  placeholder: "50.00", width: 10 },
      { path: ["adjustment", "guarantor_id"],        label: "Guarantor ID", type: "number",  placeholder: "456",                    width: 13 },
      { path: ["adjustment", "provider_id"],         label: "Provider ID",  type: "number",  placeholder: "789",                    width: 12 },
      { path: ["adjustment", "charge_id"],           label: "Charge ID",    type: "number",  placeholder: "1",                      width: 11 },
      { path: ["adjustment", "claim_id"],            label: "Claim ID",     type: "number",  placeholder: "2",                      width: 10 },
      { path: ["adjustment", "adjustment_type_id"],  label: "Type ID",      type: "number",  placeholder: "3",                      width: 9  },
      { path: ["adjustment", "description"],         label: "Description",  type: "string",  placeholder: "Discount…" },
      { path: ["adjustment", "adjusted_at"],         label: "Adjusted At",  type: "string",  placeholder: "2026-05-20",             width: 14 },
      { path: ["adjustment", "currency"],            label: "Currency",     type: "string",  placeholder: "USD",                    width: 10 },
    ],
  },
  appointments: {
    create: [
      { path: ["appt", "patient_id"],              label: "Patient ID",     type: "number",  required: true,  placeholder: "456",                 width: 13 },
      { path: ["appt", "provider_id"],             label: "Provider ID",    type: "number",  required: true,  placeholder: "789",                 width: 14 },
      { path: ["appt", "start_time"],              label: "Start Time",     type: "string",  required: true,  placeholder: "2026-05-20T09:00:00", width: 22 },
      { path: ["appt", "end_time"],                label: "End Time",       type: "string",  placeholder: "2026-05-20T10:00:00",                   width: 22 },
      { path: ["appt", "appointment_type_id"],     label: "Appt Type ID",   type: "number",  placeholder: "1",                                     width: 14 },
      { path: ["appt", "operatory_id"],            label: "Operatory ID",   type: "number",  placeholder: "2",                                     width: 13 },
      { path: ["appt", "note"],                    label: "Note",           type: "string",  placeholder: "Patient note…" },
      { path: ["appt", "unavailable"],             label: "Unavailable",    type: "boolean", placeholder: "true / false",                          width: 13 },
      { path: ["appt", "is_guardian"],             label: "Is Guardian",    type: "boolean", placeholder: "true / false",                          width: 13 },
      { path: ["appt", "is_new_clients_patient"],  label: "New Patient",    type: "boolean", placeholder: "true / false",                          width: 13 },
      { path: ["appt", "referrer"],                label: "Referrer",       type: "string",  placeholder: "referrer",                              width: 12 },
      { path: ["appt", "descriptor_ids"],          label: "Descriptor IDs", type: "ids",     placeholder: "1,2,3",                                 width: 16 },
      { path: ["appointments_per_timeslot"],        label: "Appts/Slot",    type: "number",  placeholder: "1",                                     width: 12 },
    ],
    update: [
      { path: ["appt", "confirmed"], label: "Confirmed", type: "boolean", placeholder: "true / false", width: 13 },
      { path: ["appt", "cancelled"], label: "Cancelled", type: "boolean", placeholder: "true / false", width: 13 },
    ],
  },
  onboardings: {
    create: [
      { path: ["onboarding", "institution_name"],      label: "Institution Name", type: "string", placeholder: "Acme Dental" },
      { path: ["onboarding", "institution_zip_code"],  label: "Zip Code",         type: "string", placeholder: "94105",       width: 10 },
      { path: ["onboarding", "institution_website"],   label: "Website",          type: "string", placeholder: "https://…" },
      { path: ["onboarding", "institution_email"],     label: "Email",            type: "string", placeholder: "info@…",      width: 18 },
      { path: ["onboarding", "subdomain"],             label: "Subdomain",        type: "string", placeholder: "acme-dental", width: 14 },
      { path: ["onboarding", "emr_name"],              label: "EMR",              type: "string", placeholder: "Dentrix",     width: 12 },
    ],
  },
  patients: {
    create: [
      { path: ["provider", "provider_id"],           label: "Provider ID",     type: "number",  required: true,  placeholder: "123",           width: 14 },
      { path: ["patient", "first_name"],             label: "First Name",      type: "string",  required: true,  placeholder: "Jane",          width: 13 },
      { path: ["patient", "last_name"],              label: "Last Name",       type: "string",  required: true,  placeholder: "Doe",           width: 13 },
      { path: ["patient", "email"],                  label: "Email",           type: "string",  required: true,  placeholder: "jane@…",        width: 18 },
      { path: ["patient", "bio", "date_of_birth"],   label: "Date of Birth",   type: "string",  required: true,  placeholder: "1990-01-15",    width: 16 },
      { path: ["patient", "bio", "phone_number"],    label: "Phone",           type: "string",  required: true,  placeholder: "555-555-5555",  width: 14 },
      { path: ["patient", "bio", "gender"],          label: "Gender",          type: "string",  placeholder: "Male / Female / Other",          width: 20 },
      { path: ["patient", "bio", "street_address"],  label: "Street",          type: "string",  placeholder: "123 Main St" },
      { path: ["patient", "bio", "city"],            label: "City",            type: "string",  placeholder: "San Francisco",                  width: 15 },
      { path: ["patient", "bio", "state"],           label: "State",           type: "string",  placeholder: "CA",                             width: 8  },
      { path: ["patient", "bio", "zip_code"],        label: "Zip",             type: "string",  placeholder: "94105",                          width: 8  },
      { path: ["return_existing_if_match"],           label: "Return Existing", type: "boolean", placeholder: "true / false",                  width: 17 },
    ],
  },
  payments: {
    create: [
      { path: ["payment", "patient_id"],       label: "Patient ID",    type: "number",  required: true,  placeholder: "123",   width: 13 },
      { path: ["payment", "amount"],           label: "Amount",        type: "number",  required: true,  placeholder: "50.00", width: 10 },
      { path: ["payment", "guarantor_id"],     label: "Guarantor ID",  type: "number",  placeholder: "456",                    width: 13 },
      { path: ["payment", "provider_id"],      label: "Provider ID",   type: "number",  placeholder: "789",                    width: 12 },
      { path: ["payment", "charge_id"],        label: "Charge ID",     type: "number",  placeholder: "1",                      width: 11 },
      { path: ["payment", "claim_id"],         label: "Claim ID",      type: "number",  placeholder: "2",                      width: 10 },
      { path: ["payment", "payment_type_id"],  label: "Payment Type",  type: "number",  placeholder: "3",                      width: 14 },
      { path: ["payment", "description"],      label: "Description",   type: "string",  placeholder: "Payment for…" },
      { path: ["payment", "paid_at"],          label: "Paid At",       type: "string",  placeholder: "2026-05-20",             width: 12 },
      { path: ["payment", "currency"],         label: "Currency",      type: "string",  placeholder: "USD",                    width: 10 },
    ],
  },
  webhookSubscriptions: {
    create: [
      { path: ["resource_type"], label: "Resource Type", type: "string",  required: true,  placeholder: "Appointment / Patient / …", width: 22 },
      { path: ["event"],         label: "Event",         type: "string",  required: true,  placeholder: "CREATE / UPDATE / DELETE",  width: 22 },
      { path: ["subdomain"],     label: "Subdomain",     type: "string",  placeholder: "my-practice",                               width: 14 },
      { path: ["active"],        label: "Active",        type: "boolean", placeholder: "true / false",                              width: 10 },
    ],
    update: [
      { path: ["new_endpoint_id"], label: "New Endpoint ID", type: "number",  placeholder: "123",          width: 17 },
      { path: ["active"],          label: "Active",          type: "boolean", placeholder: "true / false", width: 10 },
    ],
  },
  workingHours: {
    create: [
      { path: ["working_hour", "provider_id"],           label: "Provider ID",   type: "number",  required: true,  placeholder: "123",            width: 14 },
      { path: ["working_hour", "begin_time"],            label: "Begin Time",    type: "string",  required: true,  placeholder: "09:00",          width: 13 },
      { path: ["working_hour", "end_time"],              label: "End Time",      type: "string",  required: true,  placeholder: "17:00",          width: 12 },
      { path: ["working_hour", "operatory_id"],          label: "Operatory ID",  type: "number",  placeholder: "456",                             width: 13 },
      { path: ["working_hour", "appointment_type_ids"],  label: "Appt Type IDs", type: "ids",     placeholder: "1,2,3",                           width: 15 },
      { path: ["working_hour", "days"],                  label: "Days",          type: "strings", placeholder: "Monday,Tuesday,…" },
      { path: ["working_hour", "specific_date"],         label: "Specific Date", type: "string",  placeholder: "2026-05-20",                      width: 14 },
      { path: ["working_hour", "active"],                label: "Active",        type: "boolean", placeholder: "true / false",                    width: 10 },
      { path: ["working_hour", "label_id"],              label: "Label ID",      type: "number",  placeholder: "1",                               width: 10 },
    ],
    update: [
      { path: ["working_hour", "begin_time"],            label: "Begin Time",    type: "string",  placeholder: "09:00",        width: 12 },
      { path: ["working_hour", "end_time"],              label: "End Time",      type: "string",  placeholder: "17:00",        width: 12 },
      { path: ["working_hour", "operatory_id"],          label: "Operatory ID",  type: "number",  placeholder: "456",          width: 13 },
      { path: ["working_hour", "appointment_type_ids"],  label: "Appt Type IDs", type: "ids",     placeholder: "1,2,3",        width: 15 },
      { path: ["working_hour", "days"],                  label: "Days",          type: "strings", placeholder: "Monday,Tuesday,…" },
      { path: ["working_hour", "specific_date"],         label: "Specific Date", type: "string",  placeholder: "2026-05-20",   width: 14 },
      { path: ["working_hour", "active"],                label: "Active",        type: "boolean", placeholder: "true / false", width: 10 },
      { path: ["working_hour", "label_id"],              label: "Label ID",      type: "number",  placeholder: "1",            width: 10 },
    ],
  },
};

export const BODY_FIELDS: Record<string, BodySchema> = { v2, v2024 };
