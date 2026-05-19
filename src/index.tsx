import { createCliRenderer, SyntaxStyle, RGBA, type CliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { NexHealthClient, NexHealthAPIError } from "nexhealth-js-sdk";
import { useState, useCallback, useEffect, useRef } from "react";
import { QUERY_PARAMS, V2024_ENDPOINTS, V2024_QUERY_PARAMS, getKeyPrefix, insertSuggestion } from "./params.js";
import { loadConfig, saveConfig, clearConfig } from "./config.js";
import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let cliRenderer: CliRenderer | null = null;

const JSON_SYNTAX_STYLE = SyntaxStyle.fromStyles({
  string:  { fg: RGBA.fromHex("#9ece6a") },
  number:  { fg: RGBA.fromHex("#ff9e64") },
  keyword: { fg: RGBA.fromHex("#bb9af7") },
  default: { fg: RGBA.fromHex("#a9b1d6") },
});

// ─── Endpoint / method definitions ────────────────────────────────────────────

const ENDPOINTS: Record<string, string[]> = {
  appointmentSlots: ["list"],
  appointmentTypes: ["create", "delete", "get", "list", "update"],
  "appointmentTypes.descriptors": ["list"],
  appointments: ["create", "get", "list", "listAll", "update"],
  "appointments.descriptors": ["list"],
  availabilities: ["create", "delete", "get", "list", "listAll", "update"],
  documentTypes: ["get", "list"],
  institutions: ["get", "list"],
  locations: ["get", "list"],
  "locations.descriptors": ["list"],
  nexStaff: ["list", "listAll"],
  operatories: ["get", "list", "listAll"],
  patientAlerts: ["create", "get", "list", "update"],
  patientDocuments: ["create", "list"],
  patientRecalls: ["get", "list", "listAll"],
  patients: ["create", "get", "list", "listAll"],
  "patients.insuranceCoverages": ["list"],
  procedures: ["list", "listAll"],
  providers: ["get", "list", "listAll"],
  recallTypes: ["get", "list"],
  syncStatuses: ["list"],
  webhookEndpoints: ["create", "delete", "list", "update"],
  webhookSubscriptions: ["create", "delete", "list", "update"],
};

const NEEDS_ID = new Set(["get", "update", "delete"]);
const HAS_BODY = new Set(["create", "update"]);

// ─── Endpoint dispatch metadata ───────────────────────────────────────────────

type DispatchType =
  | { kind: "standard" }
  | { kind: "parentId"; label: string; threeArgCreate: boolean }
  | { kind: "subResource"; parent: string; sub: string; idRequired: boolean };

const ENDPOINT_DISPATCH: Record<string, DispatchType> = {
  patientAlerts:        { kind: "parentId", label: "Patient ID",  threeArgCreate: false },
  patientDocuments:     { kind: "parentId", label: "Patient ID",  threeArgCreate: true  },
  webhookSubscriptions: { kind: "parentId", label: "Endpoint ID", threeArgCreate: false },
  "appointments.descriptors":     { kind: "subResource", parent: "appointments",    sub: "descriptors",       idRequired: true  },
  "appointmentTypes.descriptors": { kind: "subResource", parent: "appointmentTypes", sub: "descriptors",      idRequired: true  },
  "locations.descriptors":        { kind: "subResource", parent: "locations",        sub: "descriptors",      idRequired: true  },
  "patients.insuranceCoverages":  { kind: "subResource", parent: "patients",         sub: "insuranceCoverages", idRequired: true },
  "feeSchedules.procedures":      { kind: "subResource", parent: "feeSchedules",     sub: "procedures",       idRequired: false },
  "workingHours.labels":          { kind: "subResource", parent: "workingHours",     sub: "labels",           idRequired: false },
};

function toLabel(key: string): string {
  const fmt = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  return key.split(".").map(fmt).join(" · ");
}

function methodDesc(method: string): string {
  const descs: Record<string, string> = {
    get: "GET /resource/:id",
    list: "GET /resource",
    listAll: "GET all pages",
    create: "POST /resource",
    update: "PATCH /resource/:id",
    delete: "DELETE /resource/:id",
  };
  return descs[method] ?? "";
}

// ─── Config Screen ─────────────────────────────────────────────────────────────

function ConfigScreen({ onStart }: { onStart: (apiKey: string, subdomain: string) => void }) {
  const [apiKey, setApiKey] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [focused, setFocused] = useState<"apiKey" | "subdomain">("apiKey");
  const [error, setError] = useState("");

  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocused((prev: "apiKey" | "subdomain") => (prev === "apiKey" ? "subdomain" : "apiKey"));
    }
  });

  const handleStart = useCallback((key: string, sub: string) => {
    if (!key.trim()) {
      setError("API key is required.");
      return;
    }
    onStart(key.trim(), sub.trim());
  }, [onStart]);

  return (
    <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <box
        title=" NexHealth API Explorer "
        border
        borderStyle="double"
        borderColor="#7aa2f7"
        flexDirection="column"
        padding={2}
        style={{ width: 60, gap: 1 }}
      >
        <text fg="#a9b1d6">API Key</text>
        <box
          border
          borderStyle="single"
          borderColor={focused === "apiKey" ? "#7aa2f7" : "#414868"}
          style={{ height: 3 }}
        >
          <input
            placeholder="Enter your NexHealth API key..."
            focused={focused === "apiKey"}
            onInput={setApiKey}
            onSubmit={() => setFocused("subdomain")}
          />
        </box>

        <text fg="#a9b1d6">Subdomain (optional)</text>
        <box
          border
          borderStyle="single"
          borderColor={focused === "subdomain" ? "#7aa2f7" : "#414868"}
          style={{ height: 3 }}
        >
          <input
            placeholder="e.g. my-practice"
            focused={focused === "subdomain"}
            onInput={setSubdomain}
            onSubmit={() => handleStart(apiKey, subdomain)}
          />
        </box>

        {error ? (
          <text fg="#f7768e">{error}</text>
        ) : (
          <text fg="#565f89">[Tab] switch field  [Enter] confirm and start</text>
        )}
      </box>
    </box>
  );
}

// ─── Explorer Screen ───────────────────────────────────────────────────────────

type ApiVersion = "v2" | "v2024";
type FocusArea = "endpoints" | "methods" | "parentId" | "id" | "query" | "body";

function ExplorerScreen({
  apiKey,
  subdomain,
  onSubdomainChange,
  onLogout,
}: {
  apiKey: string;
  subdomain: string;
  onSubdomainChange: (sub: string) => void;
  onLogout: () => void;
}) {
  const [apiVersion, setApiVersion] = useState<ApiVersion>("v2");
  const [endpointIdx, setEndpointIdx] = useState(0);
  const [methodIdx, setMethodIdx] = useState(0);
  const [focus, setFocus] = useState<FocusArea>("endpoints");
  const [editingSubdomain, setEditingSubdomain] = useState(false);
  const [subdomainDraft, setSubdomainDraft] = useState(subdomain);
  const [parentIdParam, setParentIdParam] = useState("");
  const [idParam, setIdParam] = useState("");
  const [queryParam, setQueryParam] = useState("");
  const [bodyParam, setBodyParam] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paramKey, setParamKey] = useState(0);
  const [acIdx, setAcIdx] = useState(0);
  const [queryInputKey, setQueryInputKey] = useState(0);
  const resultCache = useRef<Record<string, string>>({});

  const activeEndpoints = apiVersion === "v2" ? ENDPOINTS : V2024_ENDPOINTS;
  const activeEndpointNames = Object.keys(activeEndpoints);
  const activeQueryParams = apiVersion === "v2" ? QUERY_PARAMS : V2024_QUERY_PARAMS;

  const selectedEndpoint = activeEndpointNames[endpointIdx] ?? activeEndpointNames[0] ?? "";
  const methods = activeEndpoints[selectedEndpoint] ?? [];
  const selectedMethod = methods[methodIdx] ?? "";
  const dispatch = ENDPOINT_DISPATCH[selectedEndpoint] ?? { kind: "standard" } as DispatchType;
  const needsParentId = dispatch.kind === "parentId";
  const needsId =
    dispatch.kind === "standard"     ? NEEDS_ID.has(selectedMethod) :
    dispatch.kind === "parentId"     ? NEEDS_ID.has(selectedMethod) :
    /* subResource */                  dispatch.idRequired;
  const hasBody =
    dispatch.kind === "standard"     ? HAS_BODY.has(selectedMethod) :
    dispatch.kind === "parentId"     ? HAS_BODY.has(selectedMethod) :
    /* subResource */                  false;

  // Autocomplete: compute suggestions from the current query input value
  const keyPrefix = focus === "query" ? getKeyPrefix(queryParam) : null;
  const allQueryKeys = activeQueryParams[selectedEndpoint]?.[selectedMethod] ?? [];
  const suggestions = keyPrefix !== null
    ? allQueryKeys.filter((k) => k.startsWith(keyPrefix))
    : [];
  const showAutocomplete = suggestions.length > 0;

  useEffect(() => { setAcIdx(0); }, [keyPrefix]);

  // Reset endpoint/method selection when version switches
  useEffect(() => {
    setEndpointIdx(0);
    setMethodIdx(0);
  }, [apiVersion]);

  // Reset params when endpoint or method changes
  useEffect(() => {
    setParentIdParam("");
    setIdParam("");
    setQueryParam("");
    setBodyParam("");
    setParamKey((k: number) => k + 1);
  }, [selectedEndpoint, selectedMethod]);

  // Restore cached result when endpoint changes
  useEffect(() => {
    setResult(resultCache.current[selectedEndpoint] ?? null);
    setError(null);
  }, [selectedEndpoint]);

  const focusCycle: FocusArea[] = ["endpoints", "methods"];
  if (needsParentId) focusCycle.push("parentId");
  if (needsId) focusCycle.push("id");
  focusCycle.push("query");
  if (hasBody) focusCycle.push("body");

  const advanceFocus = useCallback(() => {
    setFocus((current: FocusArea) => {
      const idx = focusCycle.indexOf(current);
      return focusCycle[(idx + 1) % focusCycle.length] ?? "endpoints";
    });
  }, [focusCycle]);

  const runCall = useCallback(async () => {
    if (!selectedEndpoint || !selectedMethod) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const client = new NexHealthClient({
        apiKey,
        subdomain: subdomain || undefined,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vc = apiVersion === "v2" ? client.v2 : client.v2024;

      let query: object | undefined;
      if (queryParam.trim()) {
        try { query = JSON.parse(queryParam); }
        catch { throw new Error("Invalid JSON in Query Params"); }
      }

      let body: object | undefined;
      if (bodyParam.trim()) {
        try { body = JSON.parse(bodyParam); }
        catch { throw new Error("Invalid JSON in Body Params"); }
      }

      const d = ENDPOINT_DISPATCH[selectedEndpoint] ?? { kind: "standard" } as DispatchType;
      let resp: unknown;

      if (d.kind === "subResource") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = (vc as any)[d.parent]?.[d.sub];
        if (!sub) throw new Error(`Unknown sub-resource: ${selectedEndpoint}`);
        const id = d.idRequired && idParam ? parseInt(idParam, 10) : undefined;
        switch (selectedMethod) {
          case "list":    resp = d.idRequired ? await sub.list(id, query ?? {}) : await sub.list(query ?? {}); break;
          case "listAll": resp = d.idRequired ? await sub.listAll(id, query ?? {}) : await sub.listAll(query ?? {}); break;
          default: throw new Error(`Unsupported method ${selectedMethod} on sub-resource`);
        }
      } else if (d.kind === "parentId") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resource = (vc as any)[selectedEndpoint];
        if (!resource) throw new Error(`Unknown endpoint: ${selectedEndpoint}`);
        const parentId = parseInt(parentIdParam, 10);
        if (isNaN(parentId)) throw new Error(`${d.label} is required`);
        const id = idParam ? parseInt(idParam, 10) : undefined;
        switch (selectedMethod) {
          case "list":   resp = await resource.list(parentId, query ?? {}); break;
          case "create":
            resp = d.threeArgCreate
              ? await resource.create(parentId, query ?? {}, body ?? {})
              : await resource.create(parentId, body ?? {});
            break;
          case "get":    resp = await resource.get(parentId, id); break;
          case "update": resp = await resource.update(parentId, id, body ?? {}); break;
          case "delete": resp = await resource.delete(parentId, id); break;
          default: throw new Error(`Unknown method: ${selectedMethod}`);
        }
      } else {
        // standard dispatch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resource = (vc as any)[selectedEndpoint];
        if (!resource) throw new Error(`Unknown endpoint: ${selectedEndpoint}`);
        const id = needsId && idParam ? parseInt(idParam, 10) : undefined;
        switch (selectedMethod) {
          case "get":     resp = await resource.get(id, query); break;
          case "list":    resp = await resource.list(query); break;
          case "listAll": resp = await resource.listAll(query); break;
          case "create":  resp = await resource.create(query ?? {}, body ?? {}); break;
          case "update":  resp = await resource.update(id, body ?? {}); break;
          case "delete":  resp = await resource.delete(id, query); break;
          default: throw new Error(`Unknown method: ${selectedMethod}`);
        }
      }

      const json = JSON.stringify(resp, null, 2);
      resultCache.current[selectedEndpoint] = json;
      setResult(json);
    } catch (err) {
      if (err instanceof NexHealthAPIError) {
        const lines = [`HTTP ${err.status}: ${err.message}`, ...(err.errors ?? [])];
        setError(lines.join("\n"));
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, subdomain, apiVersion, selectedEndpoint, selectedMethod, needsId, parentIdParam, idParam, queryParam, bodyParam]);

  useKeyboard((key) => {
    if (editingSubdomain) {
      if (key.name === "escape") {
        setSubdomainDraft(subdomain);
        setEditingSubdomain(false);
      }
      return;
    }

    if (key.name === "tab") {
      if (focus === "query" && showAutocomplete) {
        // Accept the highlighted suggestion instead of switching panels
        const chosen = suggestions[acIdx];
        if (chosen) {
          const next = insertSuggestion(queryParam, chosen);
          setQueryParam(next);
          setQueryInputKey((k: number) => k + 1);
          setAcIdx(0);
        }
      } else {
        advanceFocus();
      }
      return;
    }

    if (focus === "query" && showAutocomplete) {
      if (key.name === "up")   { setAcIdx((i: number) => Math.max(0, i - 1)); return; }
      if (key.name === "down") { setAcIdx((i: number) => Math.min(suggestions.length - 1, i + 1)); return; }
    }

    if (key.ctrl && key.name === "o" && result) {
      const tmpFile = join(tmpdir(), `nex-result-${Date.now()}.json`);
      try {
        writeFileSync(tmpFile, result, "utf8");
        cliRenderer!.suspend();
        try {
          spawnSync(process.env["PAGER"] ?? "less", ["-R", tmpFile], { stdio: "inherit" });
        } finally {
          cliRenderer!.resume();
        }
      } finally {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
      }
      return;
    }
    if (focus === "endpoints") {
      if (key.name === "left")  { setApiVersion("v2");    return; }
      if (key.name === "right") { setApiVersion("v2024"); return; }
    }

    if (key.ctrl && key.name === "r") runCall();
    if (key.ctrl && key.name === "l") { onLogout(); return; }
    if (key.ctrl && key.name === "s") {
      setSubdomainDraft(subdomain);
      setEditingSubdomain(true);
    }
  });

  const endpointOptions = activeEndpointNames.map((k) => {
    const dot = k.indexOf(".");
    const isSub = dot !== -1;
    const subName = isSub ? k.slice(dot + 1) : "";
    return {
      name: isSub ? `  └ ${toLabel(subName)}` : toLabel(k),
      description: `${apiVersion}.${k}`,
      value: k,
    };
  });

  const methodOptions = methods.map((m) => ({
    name: m,
    description: methodDesc(m),
    value: m,
  }));

  const maskedKey =
    apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "••••";

  const inParams = focus === "id" || focus === "query" || focus === "body";

  return (
    <box flexDirection="column" flexGrow={1}>

      {/* Header */}
      <box
        flexDirection="row"
        backgroundColor="#16161e"
        style={{ height: 1, paddingLeft: 1, paddingRight: 1 }}
      >
        <text fg="#7aa2f7">NexHealth API Explorer</text>
        <text fg="#414868">  |  </text>
        <text fg="#565f89">key: </text>
        <text fg="#9ece6a">{maskedKey}</text>
        <text fg="#414868">  |  </text>
        <text fg="#565f89">subdomain: </text>
        {editingSubdomain ? (
          <input
            key="subdomain-edit"
            placeholder="subdomain..."
            focused
            onInput={setSubdomainDraft}
            onSubmit={() => {
              onSubdomainChange(subdomainDraft.trim());
              setEditingSubdomain(false);
            }}
            style={{ width: 20 }}
          />
        ) : (
          <text fg="#9ece6a">{subdomain.length > 0 ? subdomain : "(none)"}</text>
        )}
        <text fg="#414868">  |  </text>
        <text fg="#565f89">
          {editingSubdomain
            ? "[Enter] save  [Esc] cancel"
            : "[Tab] panels  [←→] version  [Ctrl+R] run  [Ctrl+S] subdomain  [Ctrl+C] quit"}
        </text>
      </box>

      {/* Three-column layout */}
      <box flexDirection="row" flexGrow={1}>

        {/* Endpoint list (with version tab-select at top) */}
        <box
          title={` Endpoints · ${apiVersion} `}
          border
          borderStyle="single"
          borderColor={focus === "endpoints" ? "#7aa2f7" : "#414868"}
          flexDirection="column"
          style={{ width: 30, flexShrink: 0 }}
        >
          <box flexDirection="row" style={{ height: 1, flexShrink: 0, paddingLeft: 1 }}>
            <text fg={apiVersion === "v2" ? "#7aa2f7" : "#565f89"}>v2</text>
            <text fg="#414868">  |  </text>
            <text fg={apiVersion === "v2024" ? "#7aa2f7" : "#565f89"}>v2024</text>
          </box>
          <select
            focused={focus === "endpoints"}
            options={endpointOptions}
            selectedIndex={endpointIdx}
            showScrollIndicator
            showDescription={false}
            wrapSelection
            onChange={(idx) => {
              setEndpointIdx(idx);
              setMethodIdx(0);
            }}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

        {/* Method list */}
        <box
          title=" Methods "
          border
          borderStyle="single"
          borderColor={focus === "methods" ? "#7aa2f7" : "#414868"}
          style={{ width: 20, flexShrink: 0 }}
        >
          <select
            focused={focus === "methods"}
            options={methodOptions}
            selectedIndex={methodIdx}
            showDescription={false}
            wrapSelection
            onChange={(idx) => setMethodIdx(idx)}
            textColor="#a9b1d6"
            focusedBackgroundColor="#1a1b26"
            selectedBackgroundColor="#283457"
            selectedTextColor="#7aa2f7"
            style={{ flexGrow: 1 }}
          />
        </box>

        {/* Right column */}
        <box flexDirection="column" flexGrow={1}>

          {/* Params panel */}
          <box
            title=" Request Params "
            border
            borderStyle="single"
            borderColor={inParams ? "#7aa2f7" : "#414868"}
            flexDirection="column"
            padding={1}
            style={{ flexShrink: 0, gap: 0 }}
          >
            {needsParentId && (
              <>
                <text fg={focus === "parentId" ? "#7aa2f7" : "#565f89"}>
                  {(dispatch as Extract<DispatchType, { kind: "parentId" }>).label} (required)
                </text>
                <box
                  border
                  borderStyle="single"
                  borderColor={focus === "parentId" ? "#7aa2f7" : "#414868"}
                  style={{ height: 3, marginBottom: 1 }}
                >
                  <input
                    key={`parentId-${paramKey}`}
                    placeholder="Parent resource ID..."
                    focused={focus === "parentId"}
                    onInput={setParentIdParam}
                    onSubmit={() => setFocus(needsId ? "id" : "query")}
                  />
                </box>
              </>
            )}

            {needsId && (
              <>
                <text fg={focus === "id" ? "#7aa2f7" : "#565f89"}>
                  {needsParentId ? "Resource ID (required)" : "ID (required)"}
                </text>
                <box
                  border
                  borderStyle="single"
                  borderColor={focus === "id" ? "#7aa2f7" : "#414868"}
                  style={{ height: 3, marginBottom: 1 }}
                >
                  <input
                    key={`id-${paramKey}`}
                    placeholder="Resource ID..."
                    focused={focus === "id"}
                    onInput={setIdParam}
                    onSubmit={() => setFocus("query")}
                  />
                </box>
              </>
            )}

            <text fg={focus === "query" ? "#7aa2f7" : "#565f89"}>
              Query Params (JSON){showAutocomplete && focus === "query" ? "  [↑↓] navigate  [Tab] accept" : ""}
            </text>
            <box
              border
              borderStyle="single"
              borderColor={focus === "query" ? "#7aa2f7" : "#414868"}
              style={{ height: 3 }}
            >
              <input
                key={`query-${paramKey}-${queryInputKey}`}
                value={queryParam}
                placeholder='{ "location_id": 123 }'
                focused={focus === "query"}
                onInput={setQueryParam}
                onSubmit={() => {
                  if (hasBody) setFocus("body");
                  else runCall();
                }}
              />
            </box>

            {/* Autocomplete suggestions */}
            {showAutocomplete && focus === "query" && (
              <box
                border
                borderStyle="single"
                borderColor="#7aa2f7"
                style={{ height: Math.min(suggestions.length, 6) + 2, marginBottom: 1 }}
              >
                <select
                  focused={false}
                  options={suggestions.map((s) => ({ name: s, description: "", value: s }))}
                  selectedIndex={acIdx}
                  showDescription={false}
                  selectedBackgroundColor="#283457"
                  selectedTextColor="#7aa2f7"
                  textColor="#a9b1d6"
                  style={{ flexGrow: 1 }}
                />
              </box>
            )}

            {!showAutocomplete && <box style={{ height: 1, marginBottom: 1 }} />}

            {hasBody && (
              <>
                <text fg={focus === "body" ? "#7aa2f7" : "#565f89"}>Body Params (JSON)</text>
                <box
                  border
                  borderStyle="single"
                  borderColor={focus === "body" ? "#7aa2f7" : "#414868"}
                  style={{ height: 3, marginBottom: 1 }}
                >
                  <input
                    key={`body-${paramKey}`}
                    placeholder='{ "user": { "first_name": "Jane" } }'
                    focused={focus === "body"}
                    onInput={setBodyParam}
                    onSubmit={runCall}
                  />
                </box>
              </>
            )}

            <text fg="#414868">
              [Ctrl+R] run  [Enter] advance/run  [Tab] switch panel
            </text>
          </box>

          {/* Result panel */}
          <box
            title={
              loading ? " Loading... " :
              error   ? " Error " :
              result  ? ` ${selectedEndpoint}.${selectedMethod}()  [Ctrl+O] open in pager ` :
                        " Result "
            }
            border
            borderStyle="single"
            borderColor={error ? "#f7768e" : result ? "#9ece6a" : "#414868"}
            flexGrow={1}
          >
            <scrollbox focused={false} style={{ flexGrow: 1 }}>
              {loading && (
                <text fg="#565f89">
                  Running {selectedEndpoint}.{selectedMethod}()...
                </text>
              )}
              {!loading && error && <text fg="#f7768e">{error}</text>}
              {!loading && result && <code content={result} filetype="json" syntaxStyle={JSON_SYNTAX_STYLE} />}
              {!loading && !result && !error && (
                <text fg="#414868">
                  Select an endpoint and method, then press [Ctrl+R] to run.
                </text>
              )}
            </scrollbox>
          </box>

        </box>
      </box>
    </box>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

function App() {
  const saved = loadConfig();
  const [screen, setScreen] = useState<"config" | "main">(saved ? "main" : "config");
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? "");
  const [subdomain, setSubdomain] = useState(saved?.subdomain ?? "");

  const handleStart = useCallback((key: string, sub: string) => {
    saveConfig({ apiKey: key, subdomain: sub });
    setApiKey(key);
    setSubdomain(sub);
    setScreen("main");
  }, []);

  const handleLogout = useCallback(() => {
    clearConfig();
    setApiKey("");
    setSubdomain("");
    setScreen("config");
  }, []);

  return screen === "config"
    ? <ConfigScreen onStart={handleStart} />
    : <ExplorerScreen apiKey={apiKey} subdomain={subdomain} onSubdomainChange={setSubdomain} onLogout={handleLogout} />;
}

cliRenderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(cliRenderer).render(<App />);
