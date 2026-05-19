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

export const V2024_ENDPOINTS: Record<string, string[]> = {
  adjustmentTypes:   ["get", "list", "listAll"],
  adjustments:       ["create", "get", "list", "listAll"],
  appointments:      ["create", "get", "list", "listAll", "update"],
  availableSlots:    ["list"],
  charges:           ["get", "list", "listAll"],
  clinicalNotes:     ["list", "listAll"],
  feeSchedules:      ["get", "list", "listAll"],
  guarantorBalances: ["get", "list", "listAll"],
  insuranceBalances: ["get", "list", "listAll"],
  insuranceClaims:   ["get", "list", "listAll"],
  insuranceCoverages:["get", "list", "listAll"],
  insurancePlans:    ["get", "list", "listAll"],
  onboardings:       ["create", "get", "list", "listAll"],
  operatories:       ["list", "listAll"],
  patientRecalls:    ["list", "listAll"],
  patients:          ["create", "get", "list", "listAll"],
  paymentTypes:      ["get", "list", "listAll"],
  payments:          ["create", "get", "list", "listAll"],
  procedures:        ["get", "list", "listAll"],
  providerSearch:    ["list"],
  providers:         ["get", "list", "listAll"],
  treatmentPlans:    ["get", "list", "listAll"],
  webhookSubscriptions: ["create", "delete", "list", "update"],
  workingHours:      ["create", "delete", "get", "list", "listAll", "update"],
};

export const V2024_QUERY_PARAMS: Record<string, Record<string, string[]>> = {
  adjustmentTypes: {
    list:    ["location_id", "updated_since", "active"],
    listAll: ["location_id", "updated_since", "active"],
  },
  adjustments: {
    create:  ["location_id"],
    get:     ["include"],
    list:    ["location_id", "patient_id", "provider_id", "guarantor_id", "claim_id", "charge_id", "updated_since", "include_deleted", "sort"],
    listAll: ["location_id", "patient_id", "provider_id", "guarantor_id", "claim_id", "charge_id", "updated_since", "include_deleted", "sort"],
  },
  appointments: {
    get:     ["include"],
    list:    ["location_id", "start", "end", "timezone", "cancelled", "unavailable", "nex_only", "updated_since", "appointment_type_id", "foreign_id", "patient_ids", "provider_ids", "operatory_ids", "created_by", "sort", "include"],
    listAll: ["location_id", "start", "end", "timezone", "cancelled", "unavailable", "nex_only", "updated_since", "appointment_type_id", "foreign_id", "patient_ids", "provider_ids", "operatory_ids", "created_by", "sort", "include"],
    create:  ["location_id", "notify_patient", "notify_practice"],
  },
  availableSlots: {
    list: ["start_date", "days", "lids", "pids", "operatory_ids", "appointment_type_id", "working_hour_label_id", "working_hour_source", "slot_length", "slot_interval", "overlapping_operatory_slots", "appointments_per_timeslot"],
  },
  charges: {
    get:     ["include"],
    list:    ["location_id", "patient_id", "provider_id", "procedure_id", "guarantor_id", "updated_since", "include_deleted", "sort", "include"],
    listAll: ["location_id", "patient_id", "provider_id", "procedure_id", "guarantor_id", "updated_since", "include_deleted", "sort", "include"],
  },
  clinicalNotes: {
    list:    ["location_id", "patient_id", "procedure_id", "entered_before", "entered_after", "updated_since"],
    listAll: ["location_id", "patient_id", "procedure_id", "entered_before", "entered_after", "updated_since"],
  },
  feeSchedules: {
    get:     ["include"],
    list:    ["location_id", "updated_since", "active"],
    listAll: ["location_id", "updated_since", "active"],
  },
  guarantorBalances: {
    get:     ["include"],
    list:    ["location_id", "guarantor_id", "updated_since", "show_zero_balances", "sort"],
    listAll: ["location_id", "guarantor_id", "updated_since", "show_zero_balances", "sort"],
  },
  insuranceBalances: {
    list:    ["location_id", "patient_id", "guarantor_id", "updated_since", "sort"],
    listAll: ["location_id", "patient_id", "guarantor_id", "updated_since", "sort"],
  },
  insuranceClaims: {
    get:     ["include"],
    list:    ["location_id", "patient_id", "provider_id", "guarantor_id", "updated_since", "date_of_service", "include_deleted", "sort"],
    listAll: ["location_id", "patient_id", "provider_id", "guarantor_id", "updated_since", "date_of_service", "include_deleted", "sort"],
  },
  insuranceCoverages: {
    list:    ["patient_id", "updated_since", "active"],
    listAll: ["patient_id", "updated_since", "active"],
  },
  insurancePlans: {
    get:     ["include"],
    list:    ["payer_id", "group_num", "updated_since", "include_deleted", "sort"],
    listAll: ["payer_id", "group_num", "updated_since", "include_deleted", "sort"],
  },
  onboardings: {
    list:    ["subdomain", "status", "sort"],
    listAll: ["subdomain", "status", "sort"],
  },
  operatories: {
    list:    ["location_id", "search_name", "foreign_id", "updated_since", "include"],
    listAll: ["location_id", "search_name", "foreign_id", "updated_since", "include"],
  },
  patientRecalls: {
    list:    ["location_id", "recall_id", "patient_id", "foreign_id", "updated_since", "due_after", "sort"],
    listAll: ["location_id", "recall_id", "patient_id", "foreign_id", "updated_since", "due_after", "sort"],
  },
  patients: {
    get:     ["include"],
    list:    ["location_id", "sort", "name", "email", "phone_number", "date_of_birth", "inactive", "foreign_id", "updated_since", "new_patient", "non_patient", "forms_syncable", "location_strict"],
    listAll: ["location_id", "sort", "name", "email", "phone_number", "date_of_birth", "inactive", "foreign_id", "updated_since", "new_patient", "non_patient", "forms_syncable", "location_strict"],
    create:  ["location_id"],
  },
  paymentTypes: {
    list:    ["location_id", "updated_since", "active"],
    listAll: ["location_id", "updated_since", "active"],
  },
  payments: {
    create:  ["location_id"],
    get:     ["include"],
    list:    ["location_id", "patient_id", "provider_id", "guarantor_id", "charge_id", "claim_id", "transaction_id", "updated_since", "include_deleted", "sort"],
    listAll: ["location_id", "patient_id", "provider_id", "guarantor_id", "charge_id", "claim_id", "transaction_id", "updated_since", "include_deleted", "sort"],
  },
  procedures: {
    list:    ["location_id", "provider_id", "patient_id", "appointment_id", "updated_since", "started_after", "started_before", "ended_after", "ended_before", "sort"],
    listAll: ["location_id", "provider_id", "patient_id", "appointment_id", "updated_since", "started_after", "started_before", "ended_after", "ended_before", "sort"],
  },
  providerSearch: {
    list: ["name_query", "npi", "zip_code", "page", "per_page"],
  },
  providers: {
    get:     ["include"],
    list:    ["location_id", "ids", "foreign_id", "requestable", "inactive", "updated_since", "sort", "include"],
    listAll: ["location_id", "ids", "foreign_id", "requestable", "inactive", "updated_since", "sort", "include"],
  },
  treatmentPlans: {
    list:    ["patient_id", "status", "updated_since"],
    listAll: ["patient_id", "status", "updated_since"],
  },
  webhookSubscriptions: {
    list: ["subdomain", "resource_type", "event"],
  },
  workingHours: {
    get:     ["include"],
    list:    ["location_id", "provider_id", "operatory_id", "label_id", "source", "active", "ignore_past_dates", "include"],
    listAll: ["location_id", "provider_id", "operatory_id", "label_id", "source", "active", "ignore_past_dates", "include"],
    create:  ["location_id"],
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
  // Strip trailing close-brace/quote/whitespace so auto-closed `{}` or `""}` doesn't break matching.
  const trimmed = value.replace(/["}\s]+$/, "");
  // After { or , (optionally whitespace), then an opening " and any letters/underscores up to end
  const keyMatch = trimmed.match(/[{,]\s*"([a-z_]*)$/);
  if (keyMatch) return keyMatch[1] ?? "";
  // Right after { or , with no quote yet — still show all
  if (/[{,]\s*$/.test(trimmed)) return "";
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
