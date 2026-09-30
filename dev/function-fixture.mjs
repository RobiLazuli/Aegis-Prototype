// Local development fixture: serves the real handleAegis handler with an
// in-memory Supabase stand-in. Fixture records are local sample data only.
// Run: node dev/function-fixture.mjs  (listens on http://127.0.0.1:8000)
import { createServer } from "node:http";
import { handleAegis } from "../functions/handler.mjs";

const tables = {
  sensor_readings: [
    {
      id: crypto.randomUUID(), room: "main", temp_centi: 2680, gas_ppm: 240,
      door_state: "closed", status: "normal",
      created_at: new Date(Date.now() - 60_000).toISOString(),
    },
  ],
  room_events: [
    { id: crypto.randomUUID(), room: "main", level: "system", message: "Local fixture started — sample data, not the cloud database.", created_at: new Date(Date.now() - 55_000).toISOString() },
    { id: crypto.randomUUID(), room: "main", level: "info", message: "Door closed.", created_at: new Date(Date.now() - 40_000).toISOString() },
    { id: crypto.randomUUID(), room: "main", level: "warn", message: "Abnormal reading — temp 34.6°C, gas 512 ppm, door closed.", created_at: new Date(Date.now() - 20_000).toISOString() },
  ],
};

function queryBuilder(rows) {
  const state = { rows: [...rows], single: false, maybe: false };
  const builder = {
    select() { return builder; },
    order(col, { ascending = true } = {}) {
      state.rows.sort((a, b) => {
        const av = a[col]; const bv = b[col];
        return (av < bv ? -1 : av > bv ? 1 : 0) * (ascending ? 1 : -1);
      });
      return builder;
    },
    range(from, to) { state.rows = state.rows.slice(from, to + 1); return builder; },
    limit(n) { state.rows = state.rows.slice(0, n); return builder; },
    single() { state.single = true; return builder; },
    maybeSingle() { state.maybe = true; return builder; },
    then(resolve) {
      if (state.single) {
        return resolve({ data: state.rows[0] ?? null, error: state.rows[0] ? null : { code: "PGRST116" } });
      }
      if (state.maybe) return resolve({ data: state.rows[0] ?? null, error: null });
      return resolve({ data: state.rows, error: null });
    },
  };
  return builder;
}

const fakeSupabase = {
  from(table) {
    const rows = tables[table];
    if (!rows) throw new Error(`unknown table ${table}`);
    return {
      select() { return queryBuilder(rows); },
      insert(row) {
        rows.push(row);
        return {
          select() {
            return { single: () => Promise.resolve({ data: row, error: null }) };
          },
          then: (resolve) => resolve({ error: null }),
        };
      },
    };
  },
};

// Provide the secrets-free env the handler expects (Deno API shim).
globalThis.Deno = { env: { get: () => undefined } };

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:8000");
  if (!url.pathname.startsWith("/functions/v1/app")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: body && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
  });
  try {
    const response = await handleAegis({ request, supabase: fakeSupabase });
    res.writeHead(response.status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(await response.text());
  } catch {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "database_request_failed" }));
  }
});

server.listen(8000, "127.0.0.1", () => {
  console.log("A.E.G.I.S local function fixture → http://127.0.0.1:8000/functions/v1/app");
});
