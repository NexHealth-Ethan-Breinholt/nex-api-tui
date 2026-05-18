import { createCliRenderer, SyntaxStyle, RGBA } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { NexHealthClient, NexHealthAPIError } from "nexhealth-js-sdk";
import { useState, useCallback, useEffect } from "react";

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
  appointments: ["create", "get", "list", "listAll", "update"],
  availabilities: ["create", "delete", "get", "list", "listAll", "update"],
  documentTypes: ["get", "list"],
  institutions: ["get", "list"],
  locations: ["get", "list"],
  nexStaff: ["list", "listAll"],
  operatories: ["get", "list", "listAll"],
  patientAlerts: ["create", "get", "list", "update"],
  patientDocuments: ["create", "list"],
  patientRecalls: ["get", "list", "listAll"],
  patients: ["create", "get", "list", "listAll"],
  procedures: ["list", "listAll"],
  providers: ["get", "list", "listAll"],
  recallTypes: ["get", "list"],
  syncStatuses: ["list"],
  webhookEndpoints: ["create", "delete", "list", "update"],
  webhookSubscriptions: ["create", "delete", "list", "update"],
};

const ENDPOINT_NAMES = Object.keys(ENDPOINTS);

const NEEDS_ID = new Set(["get", "update", "delete"]);
const HAS_BODY = new Set(["create", "update"]);

function toLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
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

type FocusArea = "endpoints" | "methods" | "id" | "query" | "body";

function ExplorerScreen({
  apiKey,
  subdomain,
  onSubdomainChange,
}: {
  apiKey: string;
  subdomain: string;
  onSubdomainChange: (sub: string) => void;
}) {
  const [endpointIdx, setEndpointIdx] = useState(0);
  const [methodIdx, setMethodIdx] = useState(0);
  const [focus, setFocus] = useState<FocusArea>("endpoints");
  const [editingSubdomain, setEditingSubdomain] = useState(false);
  const [subdomainDraft, setSubdomainDraft] = useState(subdomain);
  const [idParam, setIdParam] = useState("");
  const [queryParam, setQueryParam] = useState("");
  const [bodyParam, setBodyParam] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paramKey, setParamKey] = useState(0);

  const selectedEndpoint = ENDPOINT_NAMES[endpointIdx] ?? "appointments";
  const methods = ENDPOINTS[selectedEndpoint] ?? [];
  const selectedMethod = methods[methodIdx] ?? "";
  const needsId = NEEDS_ID.has(selectedMethod);
  const hasBody = HAS_BODY.has(selectedMethod);

  // Reset params when endpoint or method changes
  useEffect(() => {
    setIdParam("");
    setQueryParam("");
    setBodyParam("");
    setParamKey((k: number) => k + 1);
  }, [selectedEndpoint, selectedMethod]);

  const focusCycle: FocusArea[] = ["endpoints", "methods"];
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
      const resource = (client.v2 as any)[selectedEndpoint];
      if (!resource) throw new Error(`Unknown endpoint: ${selectedEndpoint}`);

      const id = needsId && idParam ? parseInt(idParam, 10) : undefined;

      let query: object | undefined;
      if (queryParam.trim()) {
        try {
          query = JSON.parse(queryParam);
        } catch {
          throw new Error("Invalid JSON in Query Params");
        }
      }

      let body: object | undefined;
      if (bodyParam.trim()) {
        try {
          body = JSON.parse(bodyParam);
        } catch {
          throw new Error("Invalid JSON in Body Params");
        }
      }

      let resp: unknown;
      switch (selectedMethod) {
        case "get":     resp = await resource.get(id, query); break;
        case "list":    resp = await resource.list(query); break;
        case "listAll": resp = await resource.listAll(query); break;
        case "create":  resp = await resource.create(query ?? {}, body ?? {}); break;
        case "update":  resp = await resource.update(id, body ?? {}); break;
        case "delete":  resp = await resource.delete(id, query); break;
        default: throw new Error(`Unknown method: ${selectedMethod}`);
      }

      setResult(JSON.stringify(resp, null, 2));
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
  }, [apiKey, subdomain, selectedEndpoint, selectedMethod, needsId, idParam, queryParam, bodyParam]);

  useKeyboard((key) => {
    if (editingSubdomain) {
      if (key.name === "escape") {
        setSubdomainDraft(subdomain);
        setEditingSubdomain(false);
      }
      return;
    }
    if (key.name === "tab") advanceFocus();
    if (key.ctrl && key.name === "r") runCall();
    if (key.ctrl && key.name === "s") {
      setSubdomainDraft(subdomain);
      setEditingSubdomain(true);
    }
  });

  const endpointOptions = ENDPOINT_NAMES.map((k) => ({
    name: toLabel(k),
    description: `v2.${k}`,
    value: k,
  }));

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
            : "[Tab] panels  [Ctrl+R] run  [Ctrl+S] subdomain  [Ctrl+C] quit"}
        </text>
      </box>

      {/* Three-column layout */}
      <box flexDirection="row" flexGrow={1}>

        {/* Endpoint list */}
        <box
          title=" Endpoints "
          border
          borderStyle="single"
          borderColor={focus === "endpoints" ? "#7aa2f7" : "#414868"}
          style={{ width: 28, flexShrink: 0 }}
        >
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
            {needsId && (
              <>
                <text fg={focus === "id" ? "#7aa2f7" : "#565f89"}>ID (required)</text>
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

            <text fg={focus === "query" ? "#7aa2f7" : "#565f89"}>Query Params (JSON)</text>
            <box
              border
              borderStyle="single"
              borderColor={focus === "query" ? "#7aa2f7" : "#414868"}
              style={{ height: 3, marginBottom: 1 }}
            >
              <input
                key={`query-${paramKey}`}
                placeholder='{ "location_id": 123 }'
                focused={focus === "query"}
                onInput={setQueryParam}
                onSubmit={() => {
                  if (hasBody) setFocus("body");
                  else runCall();
                }}
              />
            </box>

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
              result  ? ` ${selectedEndpoint}.${selectedMethod}() ` :
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
  const [screen, setScreen] = useState<"config" | "main">("config");
  const [apiKey, setApiKey] = useState("");
  const [subdomain, setSubdomain] = useState("");

  const handleStart = useCallback((key: string, sub: string) => {
    setApiKey(key);
    setSubdomain(sub);
    setScreen("main");
  }, []);

  return screen === "config"
    ? <ConfigScreen onStart={handleStart} />
    : <ExplorerScreen apiKey={apiKey} subdomain={subdomain} onSubdomainChange={setSubdomain} />;
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
