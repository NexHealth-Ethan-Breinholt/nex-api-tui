import { JSON_SYNTAX_STYLE } from "./theme.js";
import { useKeyboard } from "@opentui/react";
import { NexHealthClient, NexHealthAPIError } from "nexhealth-js-sdk";
import React, { useState, useCallback, useMemo } from "react";

// ─── Shared syntax style ──────────────────────────────────────────────────────


// ─── Data types ───────────────────────────────────────────────────────────────

type ProviderRow  = { id: number; first_name: string; last_name: string };
type OperatoryRow = { id: number; name: string };
type ApptTypeRow  = { id: number; name: string; duration?: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeEndTime(startTime: string, durationStr: string): string {
  const [hStr, mStr] = startTime.split(":");
  const h   = parseInt(hStr ?? "0", 10);
  const m   = parseInt(mStr ?? "0", 10);
  const dur = parseInt(durationStr, 10);
  if (isNaN(h) || isNaN(m) || isNaN(dur) || dur <= 0) return "";
  const total = h * 60 + m + dur;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseBool(s: string): boolean | undefined {
  const t = s.trim().toLowerCase();
  if (!t) return undefined;
  return t === "true" || t === "t" || t === "1" || t === "yes";
}

function parseIds(s: string): number[] | undefined {
  if (!s.trim()) return undefined;
  const ids = s.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n));
  return ids.length > 0 ? ids : undefined;
}

function parsePositiveInt(s: string): number | undefined {
  const n = parseInt(s.trim(), 10);
  return !isNaN(n) && n > 0 ? n : undefined;
}

function ib(active: boolean): string {  // input border color
  return active ? "#7aa2f7" : "#414868";
}

// ─── Focus cycle ──────────────────────────────────────────────────────────────

type BookingFocus =
  // Required
  | "location" | "patient" | "date" | "time" | "duration"
  // Optional — text/number
  | "note" | "referrer" | "descriptorIds" | "apptPerSlot"
  // Optional — boolean
  | "notifyPatient" | "notifyPractice" | "unavailable" | "isGuardian" | "isNewClient"
  // Selectors
  | "providers" | "operatories" | "apptTypes";

const FOCUS_CYCLE: BookingFocus[] = [
  "location", "patient", "date", "time", "duration",
  "note", "referrer", "descriptorIds", "apptPerSlot",
  "notifyPatient", "notifyPractice", "unavailable", "isGuardian", "isNewClient",
  "providers", "operatories", "apptTypes",
];

// ─── Book Appointment Tool ────────────────────────────────────────────────────

export function BookAppointmentTool({ apiKey, subdomain, onBackToList, active }: { apiKey: string; subdomain: string; onBackToList: () => void; active: boolean }) {
  const [focus, setFocus] = useState<BookingFocus>("location");
  const activeFocus = active ? focus : null;
  const [inputKey, setInputKey] = useState(0);

  // Required fields
  const [locationId,  setLocationId]  = useState("");
  const [patientId,   setPatientId]   = useState("");
  const [startDate,   setStartDate]   = useState(todayISO());
  const [startTime,   setStartTime]   = useState("09:00");
  const [durationStr, setDurationStr] = useState("60");

  // Optional — text/number
  const [note,         setNote]         = useState("");
  const [referrer,     setReferrer]     = useState("");
  const [descriptorIds, setDescriptorIds] = useState("");
  const [apptPerSlot,  setApptPerSlot]  = useState("");

  // Optional — boolean (empty = unset, "true"/"false")
  const [notifyPatient,  setNotifyPatient]  = useState("");
  const [notifyPractice, setNotifyPractice] = useState("");
  const [unavailable,    setUnavailable]    = useState("");
  const [isGuardian,     setIsGuardian]     = useState("");
  const [isNewClient,    setIsNewClient]    = useState("");

  // Fetched data
  const [providers,    setProviders]    = useState<ProviderRow[]>([]);
  const [operatories,  setOperatories]  = useState<OperatoryRow[]>([]);
  const [apptTypes,    setApptTypes]    = useState<ApptTypeRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  // Selections
  const [providerIdx,  setProviderIdx]  = useState(0);
  const [operatoryIdx, setOperatoryIdx] = useState(0);
  const [apptTypeIdx,  setApptTypeIdx]  = useState(0);

  // Result
  const [result,  setResult]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const endTime = useMemo(
    () => computeEndTime(startTime, durationStr),
    [startTime, durationStr],
  );

  const advanceFocus = useCallback(() => {
    setFocus((f: BookingFocus) => {
      const idx = FOCUS_CYCLE.indexOf(f);
      return FOCUS_CYCLE[(idx + 1) % FOCUS_CYCLE.length] ?? "location";
    });
  }, []);

  const retreatFocus = useCallback(() => {
    setFocus((f: BookingFocus) => {
      const idx = FOCUS_CYCLE.indexOf(f);
      if (idx === 0) { onBackToList(); return f; }
      return FOCUS_CYCLE[idx - 1] ?? FOCUS_CYCLE[0]!;
    });
  }, [onBackToList]);

  const nextFocus = (f: BookingFocus) => setFocus(f);

  // ── Fetch (uses v2024 for providers/operatories, v2 for appt types) ────────
  const fetchAll = useCallback(async () => {
    const locId = parseInt(locationId, 10);
    if (isNaN(locId)) { setFetchError("Enter a valid Location ID first"); return; }
    setFetchLoading(true);
    setFetchError(null);
    setResult(null);
    setError(null);
    try {
      const client = new NexHealthClient({ apiKey, subdomain: subdomain || undefined });
      const [provRes, opRes, atRes] = await Promise.all([
        client.v2024.providers.listAll({ location_id: locId }),
        client.v2024.operatories.listAll({ location_id: locId }),
        client.v2.appointmentTypes.list({ location_id: locId }),
      ]);
      setProviders((provRes.data ?? []) as ProviderRow[]);
      setOperatories((opRes.data ?? []) as OperatoryRow[]);
      setApptTypes((atRes.data ?? []) as ApptTypeRow[]);
      setProviderIdx(0);
      setOperatoryIdx(0);
      setApptTypeIdx(0);
    } catch (err) {
      setFetchError(err instanceof NexHealthAPIError ? `HTTP ${err.status}: ${err.message}` : String(err));
    } finally {
      setFetchLoading(false);
    }
  }, [apiKey, subdomain, locationId]);

  // ── Book (v2024) ──────────────────────────────────────────────────────────
  const book = useCallback(async () => {
    const locId = parseInt(locationId, 10);
    const patId = parseInt(patientId, 10);
    if (isNaN(locId)) { setError("Location ID is required"); return; }
    if (isNaN(patId)) { setError("Patient ID is required"); return; }
    if (!startDate)   { setError("Start date is required"); return; }
    if (!startTime)   { setError("Start time is required"); return; }

    const provider  = providers[providerIdx];
    if (!provider)  { setError("Select a provider (Ctrl+L to fetch first)"); return; }

    const operatory = operatoryIdx > 0 ? operatories[operatoryIdx - 1] : undefined;
    const apptType  = apptTypeIdx  > 0 ? apptTypes[apptTypeIdx - 1]   : undefined;

    const startISO = `${startDate}T${startTime}:00`;
    const endISO   = endTime ? `${startDate}T${endTime}:00` : undefined;

    const notifyPt  = parseBool(notifyPatient);
    const notifyPr  = parseBool(notifyPractice);
    const unav      = parseBool(unavailable);
    const guard     = parseBool(isGuardian);
    const newClient = parseBool(isNewClient);
    const dIds      = parseIds(descriptorIds);
    const aps       = parsePositiveInt(apptPerSlot);

    const queryParams = {
      location_id: locId,
      ...(notifyPt  !== undefined && { notify_patient:  notifyPt }),
      ...(notifyPr  !== undefined && { notify_practice: notifyPr }),
    };

    const body = {
      appt: {
        patient_id:  patId,
        provider_id: provider.id,
        start_time:  startISO,
        ...(endISO           && { end_time:              endISO }),
        ...(apptType?.id     && { appointment_type_id:   apptType.id }),
        ...(operatory?.id    && { operatory_id:          operatory.id }),
        ...(note.trim()      && { note:                  note.trim() }),
        ...(referrer.trim()  && { referrer:              referrer.trim() }),
        ...(dIds             && { descriptor_ids:        dIds }),
        ...(unav  !== undefined && { unavailable:        unav }),
        ...(guard !== undefined && { is_guardian:        guard }),
        ...(newClient !== undefined && { is_new_clients_patient: newClient }),
      },
      ...(aps !== undefined && { appointments_per_timeslot: aps }),
    };

    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const client = new NexHealthClient({ apiKey, subdomain: subdomain || undefined });
      const resp = await client.v2024.appointments.create(queryParams, body);
      setResult(JSON.stringify(resp, null, 2));
    } catch (err) {
      setError(err instanceof NexHealthAPIError
        ? [`HTTP ${err.status}: ${err.message}`, ...(err.errors ?? [])].join("\n")
        : String(err));
    } finally {
      setLoading(false);
    }
  }, [
    apiKey, subdomain, locationId, patientId, startDate, startTime, endTime,
    providers, providerIdx, operatories, operatoryIdx, apptTypes, apptTypeIdx,
    note, referrer, descriptorIds, apptPerSlot,
    notifyPatient, notifyPractice, unavailable, isGuardian, isNewClient,
  ]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useKeyboard((key) => {
    if (!active) return;
    if (key.name === "tab" && !key.shift) { advanceFocus(); return; }
    if (key.name === "tab" &&  key.shift) { retreatFocus(); return; }
    if (key.ctrl && key.name === "l") { fetchAll(); return; }
    if (key.ctrl && key.name === "r") { book();     return; }
  });

  // ── Select options ────────────────────────────────────────────────────────
  const providerOptions = providers.length > 0
    ? providers.map((p) => ({ name: `${p.first_name} ${p.last_name}`, description: `ID: ${p.id}`, value: p.id }))
    : [{ name: fetchLoading ? "Fetching…" : "(none — Ctrl+L to fetch)", description: "", value: null }];

  const operatoryOptions = operatories.length > 0
    ? [
        { name: "(none)", description: "", value: null },
        ...operatories.map((o) => ({ name: o.name, description: `ID: ${o.id}`, value: o.id })),
      ]
    : [{ name: fetchLoading ? "Fetching…" : "(none — Ctrl+L to fetch)", description: "", value: null }];

  const apptTypeOptions = apptTypes.length > 0
    ? [
        { name: "(none)", description: "", value: null },
        ...apptTypes.map((a) => ({ name: a.duration ? `${a.name} (${a.duration}m)` : a.name, description: `ID: ${a.id}`, value: a.id })),
      ]
    : [{ name: fetchLoading ? "Fetching…" : "(none — Ctrl+L to fetch)", description: "", value: null }];

  const inRequired = active && ["location", "patient", "date", "time", "duration"].includes(focus);
  const inOptional = active && ["note", "referrer", "descriptorIds", "apptPerSlot",
                      "notifyPatient", "notifyPractice", "unavailable", "isGuardian", "isNewClient"].includes(focus);

  // ── Shared input field builder ────────────────────────────────────────────
  const Field = ({
    label, width, value, focused, placeholder, onInput, onSubmit, fg,
  }: {
    label: string; width?: number; value: string; focused: boolean;
    placeholder: string; onInput: (v: string) => void; onSubmit: () => void; fg?: string;
  }) => (
    <box flexDirection="column" style={{ ...(width ? { width, flexShrink: 0 } : { flexGrow: 1 }) }}>
      <text fg={focused ? "#7aa2f7" : (fg ?? "#565f89")}>{label}</text>
      <box border borderStyle="single" borderColor={ib(focused)} style={{ height: 3 }}>
        <input
          key={`${label}-${inputKey}`}
          value={value}
          placeholder={placeholder}
          focused={focused}
          onInput={onInput}
          onSubmit={onSubmit}
        />
      </box>
    </box>
  );

  return (
    <box flexDirection="column" flexGrow={1}>

      {/* ── Required params ──────────────────────────────────────────── */}
      <box
        title=" Required "
        border borderStyle="single"
        borderColor={inRequired ? "#7aa2f7" : "#414868"}
        flexDirection="row"
        style={{ flexShrink: 0, gap: 1, paddingLeft: 1, paddingRight: 1 }}
      >
        <Field label="Location ID"  width={13} value={locationId}  focused={activeFocus === "location"}  placeholder="123"        onInput={setLocationId}  onSubmit={() => nextFocus("patient")} />
        <Field label="Patient ID"   width={11} value={patientId}   focused={activeFocus === "patient"}   placeholder="456"        onInput={setPatientId}   onSubmit={() => nextFocus("date")} />
        <Field label="Start Date"   width={16} value={startDate}   focused={activeFocus === "date"}      placeholder="YYYY-MM-DD" onInput={setStartDate}   onSubmit={() => nextFocus("time")} />
        <Field label="Start Time"   width={12} value={startTime}   focused={activeFocus === "time"}      placeholder="HH:MM"      onInput={setStartTime}   onSubmit={() => nextFocus("duration")} />
        <Field label="Dur (min)"    width={9}  value={durationStr} focused={activeFocus === "duration"}  placeholder="60"         onInput={setDurationStr} onSubmit={() => nextFocus("note")} />
        <box flexDirection="column" justifyContent="flex-end" style={{ paddingBottom: 1, flexShrink: 0 }}>
          <text fg="#565f89">→ </text>
          <text fg={endTime ? "#9ece6a" : "#414868"}>{endTime || "--:--"}</text>
        </box>
      </box>

      {/* ── Optional params ───────────────────────────────────────────── */}
      <box
        title=" Optional "
        border borderStyle="single"
        borderColor={inOptional ? "#7aa2f7" : "#414868"}
        flexDirection="row"
        style={{ flexShrink: 0, gap: 1, paddingLeft: 1, paddingRight: 1 }}
      >
        <Field label="Note"          value={note}          focused={activeFocus === "note"}          placeholder="Appointment note…" onInput={setNote}          onSubmit={() => nextFocus("referrer")}      fg="#565f89" />
        <Field label="Referrer"      width={13} value={referrer}      focused={activeFocus === "referrer"}      placeholder="referrer"         onInput={setReferrer}      onSubmit={() => nextFocus("descriptorIds")} fg="#565f89" />
        <Field label="Descriptor IDs" width={16} value={descriptorIds} focused={activeFocus === "descriptorIds"} placeholder="1,2,3"            onInput={setDescriptorIds} onSubmit={() => nextFocus("apptPerSlot")}   fg="#565f89" />
        <Field label="Appts/Slot"    width={10} value={apptPerSlot}  focused={activeFocus === "apptPerSlot"}  placeholder="1"                onInput={setApptPerSlot}  onSubmit={() => nextFocus("notifyPatient")} fg="#565f89" />
        <Field label="Notify Pt"     width={9}  value={notifyPatient}  focused={activeFocus === "notifyPatient"}  placeholder="t/f" onInput={setNotifyPatient}  onSubmit={() => nextFocus("notifyPractice")} fg="#565f89" />
        <Field label="Notify Pr"     width={9}  value={notifyPractice} focused={activeFocus === "notifyPractice"} placeholder="t/f" onInput={setNotifyPractice} onSubmit={() => nextFocus("unavailable")}    fg="#565f89" />
        <Field label="Unavail"       width={8}  value={unavailable}    focused={activeFocus === "unavailable"}    placeholder="t/f" onInput={setUnavailable}    onSubmit={() => nextFocus("isGuardian")}     fg="#565f89" />
        <Field label="Guardian"      width={9}  value={isGuardian}     focused={activeFocus === "isGuardian"}     placeholder="t/f" onInput={setIsGuardian}     onSubmit={() => nextFocus("isNewClient")}    fg="#565f89" />
        <Field label="New Client"    width={10} value={isNewClient}    focused={activeFocus === "isNewClient"}    placeholder="t/f" onInput={setIsNewClient}    onSubmit={() => nextFocus("providers")}      fg="#565f89" />
      </box>

      {/* ── Selector columns ─────────────────────────────────────────── */}
      <box flexDirection="row" flexGrow={1}>

        <box title=" Providers " border borderStyle="single"
          borderColor={activeFocus === "providers" ? "#7aa2f7" : "#414868"}
          style={{ flexGrow: 1 }}
        >
          <select
            focused={activeFocus === "providers"}
            options={providerOptions}
            selectedIndex={providerIdx}
            showDescription
            showScrollIndicator
            wrapSelection={false}
            onChange={(idx) => setProviderIdx(idx)}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            descriptionColor="#565f89"
            selectedDescriptionColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

        <box title=" Operatories " border borderStyle="single"
          borderColor={activeFocus === "operatories" ? "#7aa2f7" : "#414868"}
          style={{ flexGrow: 1 }}
        >
          <select
            focused={activeFocus === "operatories"}
            options={operatoryOptions}
            selectedIndex={operatoryIdx}
            showDescription
            showScrollIndicator
            wrapSelection={false}
            onChange={(idx) => setOperatoryIdx(idx)}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            descriptionColor="#565f89"
            selectedDescriptionColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

        <box title=" Appt Types " border borderStyle="single"
          borderColor={activeFocus === "apptTypes" ? "#7aa2f7" : "#414868"}
          style={{ flexGrow: 1 }}
        >
          <select
            focused={activeFocus === "apptTypes"}
            options={apptTypeOptions}
            selectedIndex={apptTypeIdx}
            showDescription
            showScrollIndicator
            wrapSelection={false}
            onChange={(idx) => setApptTypeIdx(idx)}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            descriptionColor="#565f89"
            selectedDescriptionColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

      </box>

      {/* ── Result ───────────────────────────────────────────────────── */}
      <box
        title={
          loading      ? " Booking… " :
          error        ? " Error " :
          result       ? " Appointment Created " :
          fetchError   ? " Fetch Error " :
          fetchLoading ? " Fetching… " :
                         " Result "
        }
        border borderStyle="single"
        borderColor={error || fetchError ? "#f7768e" : result ? "#9ece6a" : "#414868"}
        style={{ height: 18, flexShrink: 0 }}
      >
        <scrollbox focused={false} style={{ flexGrow: 1 }}>
          {(loading || fetchLoading) && <text fg="#565f89">Working…</text>}
          {!loading && !fetchLoading && fetchError && <text fg="#f7768e">{fetchError}</text>}
          {!loading && !fetchLoading && error       && <text fg="#f7768e">{error}</text>}
          {!loading && !fetchLoading && result      && <code content={result} filetype="javascript" syntaxStyle={JSON_SYNTAX_STYLE} />}
          {!loading && !fetchLoading && !result && !error && !fetchError && (
            <text fg="#414868">Fill params · [Ctrl+L] fetch lists · [Ctrl+R] book · booleans: t/f/true/false</text>
          )}
        </scrollbox>
      </box>

    </box>
  );
}

// ─── Available Slots Tool ─────────────────────────────────────────────────────

type SlotsFocus =
  | "location" | "date" | "days"
  | "slotLength" | "slotInterval" | "overlapping" | "apptPerSlot" | "whLabelId" | "whSource"
  | "providers" | "operatories" | "apptTypes";

const SLOTS_FOCUS_CYCLE: SlotsFocus[] = [
  "location", "date", "days",
  "slotLength", "slotInterval", "overlapping", "apptPerSlot", "whLabelId", "whSource",
  "providers", "operatories", "apptTypes",
];

export function AvailableSlotsTool({ apiKey, subdomain, onBackToList, active }: { apiKey: string; subdomain: string; onBackToList: () => void; active: boolean }) {
  const [focus, setFocus] = useState<SlotsFocus>("location");
  const activeFocus = active ? focus : null;
  const [inputKey] = useState(0);

  // Required
  const [locationId, setLocationId] = useState("");
  const [startDate,  setStartDate]  = useState(todayISO());
  const [daysStr,    setDaysStr]    = useState("7");

  // Optional
  const [slotLength,   setSlotLength]   = useState("");
  const [slotInterval, setSlotInterval] = useState("");
  const [overlapping,  setOverlapping]  = useState("");
  const [apptPerSlot,  setApptPerSlot]  = useState("");
  const [whLabelId,    setWhLabelId]    = useState("");
  const [whSource,     setWhSource]     = useState("");

  // Fetched data
  const [providers,    setProviders]    = useState<ProviderRow[]>([]);
  const [operatories,  setOperatories]  = useState<OperatoryRow[]>([]);
  const [apptTypes,    setApptTypes]    = useState<ApptTypeRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  // Selections — all optional, 0 = "(none)"
  const [providerIdx,  setProviderIdx]  = useState(0);
  const [operatoryIdx, setOperatoryIdx] = useState(0);
  const [apptTypeIdx,  setApptTypeIdx]  = useState(0);

  // Result
  const [result,  setResult]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const advanceFocus = useCallback(() => {
    setFocus((f: SlotsFocus) => {
      const idx = SLOTS_FOCUS_CYCLE.indexOf(f);
      return SLOTS_FOCUS_CYCLE[(idx + 1) % SLOTS_FOCUS_CYCLE.length] ?? "location";
    });
  }, []);

  const retreatFocus = useCallback(() => {
    setFocus((f: SlotsFocus) => {
      const idx = SLOTS_FOCUS_CYCLE.indexOf(f);
      if (idx === 0) { onBackToList(); return f; }
      return SLOTS_FOCUS_CYCLE[idx - 1] ?? SLOTS_FOCUS_CYCLE[0]!;
    });
  }, [onBackToList]);

  const nextFocus = (f: SlotsFocus) => setFocus(f);

  const fetchAll = useCallback(async () => {
    const locId = parseInt(locationId, 10);
    if (isNaN(locId)) { setFetchError("Enter a valid Location ID first"); return; }
    setFetchLoading(true);
    setFetchError(null);
    setResult(null);
    setError(null);
    try {
      const client = new NexHealthClient({ apiKey, subdomain: subdomain || undefined });
      const [provRes, opRes, atRes] = await Promise.all([
        client.v2024.providers.listAll({ location_id: locId }),
        client.v2024.operatories.listAll({ location_id: locId }),
        client.v2.appointmentTypes.list({ location_id: locId }),
      ]);
      setProviders((provRes.data ?? []) as ProviderRow[]);
      setOperatories((opRes.data ?? []) as OperatoryRow[]);
      setApptTypes((atRes.data ?? []) as ApptTypeRow[]);
      setProviderIdx(0);
      setOperatoryIdx(0);
      setApptTypeIdx(0);
    } catch (err) {
      setFetchError(err instanceof NexHealthAPIError ? `HTTP ${err.status}: ${err.message}` : String(err));
    } finally {
      setFetchLoading(false);
    }
  }, [apiKey, subdomain, locationId]);

  const search = useCallback(async () => {
    const locId = parseInt(locationId, 10);
    if (isNaN(locId))  { setError("Location ID is required"); return; }
    if (!startDate)    { setError("Start date is required"); return; }
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days <= 0) { setError("Days must be a positive number"); return; }

    const provider  = providerIdx  > 0 ? providers[providerIdx - 1]   : undefined;
    const operatory = operatoryIdx > 0 ? operatories[operatoryIdx - 1] : undefined;
    const apptType  = apptTypeIdx  > 0 ? apptTypes[apptTypeIdx - 1]   : undefined;

    const sl    = parsePositiveInt(slotLength);
    const si    = parsePositiveInt(slotInterval);
    const ovlp  = parseBool(overlapping);
    const aps   = parsePositiveInt(apptPerSlot);
    const whLId = parsePositiveInt(whLabelId);

    const query = {
      start_date: startDate,
      days,
      lids: [locId],
      ...(provider  && { pids:                       [provider.id] }),
      ...(operatory && { operatory_ids:               [operatory.id] }),
      ...(apptType  && { appointment_type_id:          apptType.id }),
      ...(sl   !== undefined && { slot_length:                   sl }),
      ...(si   !== undefined && { slot_interval:                 si }),
      ...(ovlp !== undefined && { overlapping_operatory_slots:   ovlp }),
      ...(aps  !== undefined && { appointments_per_timeslot:     aps }),
      ...(whLId !== undefined && { working_hour_label_id:        whLId }),
      ...(whSource.trim() && { working_hour_source:              whSource.trim() }),
    };

    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const client = new NexHealthClient({ apiKey, subdomain: subdomain || undefined });
      const resp = await client.v2024.availableSlots.list(query);
      setResult(JSON.stringify(resp, null, 2));
    } catch (err) {
      setError(err instanceof NexHealthAPIError
        ? [`HTTP ${err.status}: ${err.message}`, ...(err.errors ?? [])].join("\n")
        : String(err));
    } finally {
      setLoading(false);
    }
  }, [
    apiKey, subdomain, locationId, startDate, daysStr,
    providers, providerIdx, operatories, operatoryIdx, apptTypes, apptTypeIdx,
    slotLength, slotInterval, overlapping, apptPerSlot, whLabelId, whSource,
  ]);

  useKeyboard((key) => {
    if (!active) return;
    if (key.name === "tab" && !key.shift) { advanceFocus(); return; }
    if (key.name === "tab" &&  key.shift) { retreatFocus(); return; }
    if (key.ctrl && key.name === "l") { fetchAll(); return; }
    if (key.ctrl && key.name === "r") { search();   return; }
  });

  // All three selectors are optional — all have "(none)" when data is loaded
  const providerOptions = providers.length > 0
    ? [
        { name: "(none)", description: "", value: null },
        ...providers.map((p) => ({ name: `${p.first_name} ${p.last_name}`, description: `ID: ${p.id}`, value: p.id })),
      ]
    : [{ name: fetchLoading ? "Fetching…" : "(none — Ctrl+L to fetch)", description: "", value: null }];

  const operatoryOptions = operatories.length > 0
    ? [
        { name: "(none)", description: "", value: null },
        ...operatories.map((o) => ({ name: o.name, description: `ID: ${o.id}`, value: o.id })),
      ]
    : [{ name: fetchLoading ? "Fetching…" : "(none — Ctrl+L to fetch)", description: "", value: null }];

  const apptTypeOptions = apptTypes.length > 0
    ? [
        { name: "(none)", description: "", value: null },
        ...apptTypes.map((a) => ({ name: a.duration ? `${a.name} (${a.duration}m)` : a.name, description: `ID: ${a.id}`, value: a.id })),
      ]
    : [{ name: fetchLoading ? "Fetching…" : "(none — Ctrl+L to fetch)", description: "", value: null }];

  const inRequired = active && (["location", "date", "days"] as SlotsFocus[]).includes(focus);
  const inOptional = active && (["slotLength", "slotInterval", "overlapping", "apptPerSlot", "whLabelId", "whSource"] as SlotsFocus[]).includes(focus);

  const Field = ({
    label, width, value, focused, placeholder, onInput, onSubmit, fg,
  }: {
    label: string; width?: number; value: string; focused: boolean;
    placeholder: string; onInput: (v: string) => void; onSubmit: () => void; fg?: string;
  }) => (
    <box flexDirection="column" style={{ ...(width ? { width, flexShrink: 0 } : { flexGrow: 1 }) }}>
      <text fg={focused ? "#7aa2f7" : (fg ?? "#565f89")}>{label}</text>
      <box border borderStyle="single" borderColor={ib(focused)} style={{ height: 3 }}>
        <input
          key={`slots-${label}-${inputKey}`}
          value={value}
          placeholder={placeholder}
          focused={focused}
          onInput={onInput}
          onSubmit={onSubmit}
        />
      </box>
    </box>
  );

  return (
    <box flexDirection="column" flexGrow={1}>

      {/* ── Required params ──────────────────────────────────────────── */}
      <box
        title=" Required "
        border borderStyle="single"
        borderColor={inRequired ? "#7aa2f7" : "#414868"}
        flexDirection="row"
        style={{ flexShrink: 0, gap: 1, paddingLeft: 1, paddingRight: 1 }}
      >
        <Field label="Location ID" width={13} value={locationId} focused={activeFocus === "location"} placeholder="123"        onInput={setLocationId} onSubmit={() => nextFocus("date")} />
        <Field label="Start Date"  width={16} value={startDate}  focused={activeFocus === "date"}     placeholder="YYYY-MM-DD" onInput={setStartDate}  onSubmit={() => nextFocus("days")} />
        <Field label="Days"        width={7}  value={daysStr}    focused={activeFocus === "days"}     placeholder="7"          onInput={setDaysStr}    onSubmit={() => nextFocus("slotLength")} />
      </box>

      {/* ── Optional params ───────────────────────────────────────────── */}
      <box
        title=" Optional "
        border borderStyle="single"
        borderColor={inOptional ? "#7aa2f7" : "#414868"}
        flexDirection="row"
        style={{ flexShrink: 0, gap: 1, paddingLeft: 1, paddingRight: 1 }}
      >
        <Field label="Slot Length"   width={13} value={slotLength}   focused={activeFocus === "slotLength"}   placeholder="30"     onInput={setSlotLength}   onSubmit={() => nextFocus("slotInterval")} fg="#565f89" />
        <Field label="Slot Interval" width={14} value={slotInterval}  focused={activeFocus === "slotInterval"}  placeholder="15"     onInput={setSlotInterval}  onSubmit={() => nextFocus("overlapping")}  fg="#565f89" />
        <Field label="Overlapping"   width={12} value={overlapping}   focused={activeFocus === "overlapping"}   placeholder="t/f"    onInput={setOverlapping}   onSubmit={() => nextFocus("apptPerSlot")}  fg="#565f89" />
        <Field label="Appts/Slot"    width={11} value={apptPerSlot}   focused={activeFocus === "apptPerSlot"}   placeholder="1"      onInput={setApptPerSlot}   onSubmit={() => nextFocus("whLabelId")}    fg="#565f89" />
        <Field label="WH Label ID"   width={13} value={whLabelId}     focused={activeFocus === "whLabelId"}     placeholder="123"    onInput={setWhLabelId}     onSubmit={() => nextFocus("whSource")}     fg="#565f89" />
        <Field label="WH Source"                value={whSource}      focused={activeFocus === "whSource"}      placeholder="source" onInput={setWhSource}      onSubmit={() => nextFocus("providers")}    fg="#565f89" />
      </box>

      {/* ── Selector columns ─────────────────────────────────────────── */}
      <box flexDirection="row" flexGrow={1}>

        <box title=" Providers " border borderStyle="single"
          borderColor={activeFocus === "providers" ? "#7aa2f7" : "#414868"}
          style={{ flexGrow: 1 }}
        >
          <select
            focused={activeFocus === "providers"}
            options={providerOptions}
            selectedIndex={providerIdx}
            showDescription
            showScrollIndicator
            wrapSelection={false}
            onChange={(idx) => setProviderIdx(idx)}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            descriptionColor="#565f89"
            selectedDescriptionColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

        <box title=" Operatories " border borderStyle="single"
          borderColor={activeFocus === "operatories" ? "#7aa2f7" : "#414868"}
          style={{ flexGrow: 1 }}
        >
          <select
            focused={activeFocus === "operatories"}
            options={operatoryOptions}
            selectedIndex={operatoryIdx}
            showDescription
            showScrollIndicator
            wrapSelection={false}
            onChange={(idx) => setOperatoryIdx(idx)}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            descriptionColor="#565f89"
            selectedDescriptionColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

        <box title=" Appt Types " border borderStyle="single"
          borderColor={activeFocus === "apptTypes" ? "#7aa2f7" : "#414868"}
          style={{ flexGrow: 1 }}
        >
          <select
            focused={activeFocus === "apptTypes"}
            options={apptTypeOptions}
            selectedIndex={apptTypeIdx}
            showDescription
            showScrollIndicator
            wrapSelection={false}
            onChange={(idx) => setApptTypeIdx(idx)}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            descriptionColor="#565f89"
            selectedDescriptionColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

      </box>

      {/* ── Result ───────────────────────────────────────────────────── */}
      <box
        title={
          loading      ? " Searching… " :
          error        ? " Error " :
          result       ? " Available Slots " :
          fetchError   ? " Fetch Error " :
          fetchLoading ? " Fetching… " :
                         " Result "
        }
        border borderStyle="single"
        borderColor={error || fetchError ? "#f7768e" : result ? "#9ece6a" : "#414868"}
        style={{ height: 18, flexShrink: 0 }}
      >
        <scrollbox focused={false} style={{ flexGrow: 1 }}>
          {(loading || fetchLoading) && <text fg="#565f89">Working…</text>}
          {!loading && !fetchLoading && fetchError && <text fg="#f7768e">{fetchError}</text>}
          {!loading && !fetchLoading && error       && <text fg="#f7768e">{error}</text>}
          {!loading && !fetchLoading && result      && <code content={result} filetype="javascript" syntaxStyle={JSON_SYNTAX_STYLE} />}
          {!loading && !fetchLoading && !result && !error && !fetchError && (
            <text fg="#414868">Fill params · [Ctrl+L] fetch lists · [Ctrl+R] search · booleans: t/f/true/false</text>
          )}
        </scrollbox>
      </box>

    </box>
  );
}

// ─── Tool registry ────────────────────────────────────────────────────────────

type ToolProps = { apiKey: string; subdomain: string; onBackToList: () => void; active: boolean };
type Tool = {
  name:      string;
  component: React.FC<ToolProps>;
};

export const TOOLS: Tool[] = [
  { name: "Book Appointment", component: BookAppointmentTool },
  { name: "Available Slots",  component: AvailableSlotsTool },
];

// ─── Tools Screen ─────────────────────────────────────────────────────────────

type ToolsFocus = "list" | "tool";

export function ToolsScreen({
  apiKey,
  subdomain,
  onSwitchToExplorer,
}: {
  apiKey:             string;
  subdomain:          string;
  onSwitchToExplorer: () => void;
}) {
  const [toolIdx,    setToolIdx]    = useState(0);
  const [toolsFocus, setToolsFocus] = useState<ToolsFocus>("list");

  useKeyboard((key) => {
    if (key.ctrl && key.name === "t") { onSwitchToExplorer(); return; }
    if (toolsFocus === "list") {
      if (key.name === "up")    { setToolIdx((i: number) => Math.max(0, i - 1)); return; }
      if (key.name === "down")  { setToolIdx((i: number) => Math.min(TOOLS.length - 1, i + 1)); return; }
      if (key.name === "tab" && !key.shift) { setToolsFocus("tool"); return; }
      if (key.name === "enter") { setToolsFocus("tool"); return; }
    }
  });

  const selected = TOOLS[toolIdx]!;

  return (
    <box flexDirection="column" flexGrow={1}>

      {/* Header */}
      <box
        flexDirection="row"
        backgroundColor="#16161e"
        style={{ height: 1, paddingLeft: 1, paddingRight: 1 }}
      >
        <text fg="#7aa2f7">NexHealth Tools</text>
        <text fg="#414868">  |  </text>
        <text fg="#565f89">subdomain: </text>
        <text fg="#9ece6a">{subdomain || "(none)"}</text>
        <text fg="#414868">  |  </text>
        <text fg="#565f89">[Tab] next field  [Ctrl+L] fetch  [Ctrl+R] run  [Ctrl+T] explorer  [Ctrl+C] quit</text>
      </box>

      <box flexDirection="row" flexGrow={1}>

        {/* Tools list */}
        <box
          title=" Tools "
          border borderStyle="single"
          borderColor={toolsFocus === "list" ? "#7aa2f7" : "#414868"}
          style={{ width: 22, flexShrink: 0 }}
        >
          <select
            focused={toolsFocus === "list"}
            options={TOOLS.map((t) => ({ name: t.name, description: "", value: t.name }))}
            selectedIndex={toolIdx}
            showDescription={false}
            wrapSelection={false}
            onChange={(idx) => setToolIdx(idx)}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

        {/* Active tool */}
        {React.createElement(selected.component, { apiKey, subdomain, onBackToList: () => setToolsFocus("list"), active: toolsFocus === "tool" })}

      </box>
    </box>
  );
}
