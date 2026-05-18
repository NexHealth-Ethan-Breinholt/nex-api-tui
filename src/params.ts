// Static map of query param keys per endpoint+method, extracted from nexhealth-js-sdk types.
export const QUERY_PARAMS: Record<string, Record<string, string[]>> = {
  appointmentSlots: {
    list: ["start_date", "days", "lids", "pids", "operatory_ids", "appointment_type_id", "slot_length", "slot_interval", "overlapping_operatory_slots"],
  },
  appointmentTypes: {
    get:    ["location_id", "include"],
    list:   ["location_id", "include"],
    delete: ["location_id"],
  },
  appointments: {
    get:     ["include"],
    list:    ["location_id", "start", "end", "timezone", "cancelled", "unavailable", "nex_only", "updated_since", "appointment_type_id", "foreign_id", "patient_id", "provider_ids", "operatory_ids", "created_by", "include", "page", "per_page"],
    listAll: ["location_id", "start", "end", "timezone", "cancelled", "unavailable", "nex_only", "updated_since", "appointment_type_id", "foreign_id", "patient_id", "provider_ids", "operatory_ids", "created_by", "include"],
    create:  ["location_id", "notify_patient"],
  },
  availabilities: {
    get:     ["include"],
    list:    ["location_id", "include", "provider_id", "operatory_id", "active", "ignore_past_dates", "page", "per_page"],
    listAll: ["location_id", "include", "provider_id", "operatory_id", "active", "ignore_past_dates"],
    create:  ["location_id"],
  },
  documentTypes: {
    get:  ["location_id"],
    list: ["location_id", "active"],
  },
  locations: {
    list: ["inactive", "foreign_id", "filter_by_subscription_feature"],
  },
  nexStaff: {
    list:    ["inactive", "location_ids", "page", "per_page"],
    listAll: ["inactive", "location_ids"],
  },
  operatories: {
    get:     ["include"],
    list:    ["location_id", "search_name", "foreign_id", "updated_since", "include", "page", "per_page"],
    listAll: ["location_id", "search_name", "foreign_id", "updated_since", "include"],
  },
  patientAlerts: {
    list: ["include_disabled"],
  },
  patientDocuments: {
    list:   ["page", "per_page"],
    create: ["location_id"],
  },
  patientRecalls: {
    list:    ["location_id", "recall_id", "patient_id", "foreign_id", "updated_since", "due_after", "sort", "page", "per_page"],
    listAll: ["location_id", "recall_id", "patient_id", "foreign_id", "updated_since", "due_after", "sort"],
  },
  patients: {
    get:     ["include"],
    list:    ["location_id", "name", "email", "phone_number", "date_of_birth", "inactive", "foreign_id", "updated_since", "new_patient", "non_patient", "forms_syncable", "location_strict", "include", "sort", "appointment_date_start", "appointment_date_end", "page", "per_page"],
    listAll: ["location_id", "name", "email", "phone_number", "date_of_birth", "inactive", "foreign_id", "updated_since", "new_patient", "non_patient", "forms_syncable", "location_strict", "include", "sort", "appointment_date_start", "appointment_date_end"],
    create:  ["location_id"],
  },
  procedures: {
    list:    ["location_id", "provider_id", "patient_id", "appointment_id", "updated_after", "page", "per_page"],
    listAll: ["location_id", "provider_id", "patient_id", "appointment_id", "updated_after"],
  },
  providers: {
    get:     ["include"],
    list:    ["include", "location_id", "ids", "foreign_id", "requestable", "inactive", "updated_since", "page", "per_page"],
    listAll: ["include", "location_id", "ids", "foreign_id", "requestable", "inactive", "updated_since"],
  },
  recallTypes: {
    list: ["location_id", "foreign_id", "updated_since"],
  },
  syncStatuses: {
    list: ["location_ids", "read_status", "write_status"],
  },
  webhookEndpoints: {
    list: ["active"],
  },
  webhookSubscriptions: {
    list: ["resource_type", "event"],
  },
};

/**
 * Returns the partial key string the user is currently typing, or null if the
 * cursor is not in a key position. Handles patterns like:
 *   {           → ''     (show all keys)
 *   {"loc       → 'loc'
 *   {"a": 1, "  → ''    (show all remaining keys)
 *   {"a": 1, "p → 'p'
 *   {"a": 1     → null  (cursor is in value context)
 */
export function getKeyPrefix(value: string): string | null {
  // After { or , (optionally whitespace), then an opening " and any letters/underscores up to end
  const keyMatch = value.match(/[{,]\s*"([a-z_]*)$/);
  if (keyMatch) return keyMatch[1] ?? "";
  // Right after { or , with no quote yet — still show all
  if (/[{,]\s*$/.test(value)) return "";
  return null;
}

/**
 * Inserts a completed key suggestion into the current query param string.
 * e.g. insertSuggestion('{"lo', 'location_id') → '{"location_id": '
 */
export function insertSuggestion(currentValue: string, suggestion: string): string {
  const prefix = getKeyPrefix(currentValue);
  if (prefix === null) return currentValue;
  // Strip the partial prefix that was already typed
  const base = currentValue.slice(0, currentValue.length - prefix.length);
  // Ensure the opening quote is present
  if (!base.endsWith('"')) return base + '"' + suggestion + '": ';
  return base + suggestion + '": ';
}
