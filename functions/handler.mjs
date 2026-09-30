// A.E.G.I.S room-guardian business handler.
// Reads are public (single-room class project, limited functional test scope).
// Writes from firmware are gated by the DEVICE_API_KEY application secret.
const json = (body, status = 200, headers = {}) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", ...headers },
});

const ROOM_PATTERN = /^[a-z0-9-]{1,24}$/;
const LOG_PAGE = 20;

function roomStatus(tempC, gasPpm, door) {
  if (tempC >= 38 || gasPpm >= 800) return "danger";
  if (tempC >= 34 || gasPpm >= 500 || door === "open") return "abnormal";
  return "normal";
}

// Fixed upstream with a bounded timeout; never returns raw upstream errors.
async function sendTelegram(text) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return "not_configured";
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

function deviceAuthorized(request) {
  const expected = Deno.env.get("DEVICE_API_KEY");
  if (!expected) return "not_configured";
  return request.headers.get("x-device-key") === expected ? "ok" : "denied";
}

async function readJsonBody(request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 8192) return { error: "body_too_large" };
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "invalid_body" };
    return { body };
  } catch {
    return { error: "invalid_body" };
  }
}

async function listStatus({ supabase }) {
  const { data, error } = await supabase.from("sensor_readings")
    .select("temp_centi,gas_ppm,door_state,status,created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !Array.isArray(data)) return json({ error: "database_request_failed" }, 503);
  const row = data[0] ?? null;
  return json({
    ok: true,
    room: "main",
    reading: row ? {
      tempC: row.temp_centi / 100,
      gasPpm: row.gas_ppm,
      door: row.door_state,
      status: row.status,
      at: row.created_at,
    } : null,
  });
}

async function listLogs({ params, supabase }) {
  const rawOffset = params.get("offset") ?? "0";
  if (!/^(0|[1-9][0-9]{0,5})$/.test(rawOffset)) return json({ error: "invalid_offset" }, 400);
  const offset = Number(rawOffset);
  const { data, error } = await supabase.from("room_events")
    .select("id,level,message,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + LOG_PAGE);
  if (error || !Array.isArray(data)) return json({ error: "database_request_failed" }, 503);
  const hasMore = data.length > LOG_PAGE;
  const items = data.slice(0, LOG_PAGE).map((row) => ({
    id: row.id,
    level: row.level,
    message: row.message,
    at: row.created_at,
  }));
  return json({ ok: true, items, hasMore, nextOffset: hasMore ? offset + LOG_PAGE : null });
}

async function ingest({ request, supabase }) {
  const auth = deviceAuthorized(request);
  if (auth === "not_configured") return json({ error: "service_not_configured" }, 503);
  if (auth === "denied") return json({ error: "device_key_invalid" }, 403);

  const { body, error: bodyError } = await readJsonBody(request);
  if (bodyError) return json({ error: bodyError }, 400);

  const room = typeof body.room === "string" && ROOM_PATTERN.test(body.room) ? body.room : "main";
  const tempC = Number(body.temp_c);
  const gasPpm = Number(body.gas_ppm);
  const door = body.door_state;
  if (!Number.isFinite(tempC) || tempC < -40 || tempC > 85) return json({ error: "invalid_temp" }, 400);
  if (!Number.isInteger(gasPpm) || gasPpm < 0 || gasPpm > 10000) return json({ error: "invalid_gas" }, 400);
  if (door !== "open" && door !== "closed") return json({ error: "invalid_door" }, 400);

  const status = roomStatus(tempC, gasPpm, door);
  const roundedTemp = Math.round(tempC * 100) / 100;

  const inserted = await supabase.from("sensor_readings").insert({
    id: crypto.randomUUID(),
    room,
    temp_centi: Math.round(tempC * 100),
    gas_ppm: gasPpm,
    door_state: door,
    status,
    created_at: new Date().toISOString(),
  }).select("id").single();
  if (inserted.error || !inserted.data) return json({ error: "database_request_failed" }, 503);

  let telegram = "skipped";
  if (status !== "normal") {
    const level = status === "danger" ? "danger" : "warn";
    const message = status === "danger"
      ? `DANGER — temp ${roundedTemp}°C, gas ${gasPpm} ppm, door ${door}.`
      : `Abnormal reading — temp ${roundedTemp}°C, gas ${gasPpm} ppm, door ${door}.`;
    const event = await supabase.from("room_events").insert({
      id: crypto.randomUUID(), room, level, message,
      created_at: new Date().toISOString(),
    });
    if (event.error) return json({ error: "database_request_failed" }, 503);
    telegram = await sendTelegram(
      `🛡 A.E.G.I.S [${room}] ${status.toUpperCase()}\n${message}`,
    );
  }
  return json({ ok: true, status, telegram });
}

async function cameraEvent({ request, supabase }) {
  const { body, error: bodyError } = await readJsonBody(request);
  if (bodyError) return json({ error: bodyError }, 400);

  const imageBytes = Number(body.imageBytes);
  const note = typeof body.note === "string" ? body.note.slice(0, 120) : "";
  if (!Number.isSafeInteger(imageBytes) || imageBytes < 0 || imageBytes > 5_000_000) {
    return json({ error: "invalid_image_bytes" }, 400);
  }

  const kb = Math.max(1, Math.round(imageBytes / 1024));
  const event = await supabase.from("room_events").insert({
    id: crypto.randomUUID(),
    room: "main",
    level: "info",
    message: `Camera frame captured (${kb} kB)${note ? ` — ${note}` : ""}.`,
    created_at: new Date().toISOString(),
  });
  if (event.error) return json({ error: "database_request_failed" }, 503);
  return json({ ok: true, telegram: "skipped" });
}

async function testAlert({ request }) {
  const auth = deviceAuthorized(request);
  if (auth === "not_configured") return json({ error: "service_not_configured" }, 503);
  if (auth === "denied") return json({ error: "device_key_invalid" }, 403);
  const telegram = await sendTelegram("🛡 A.E.G.I.S test alert — the Telegram relay is wired up.");
  if (telegram === "not_configured") return json({ error: "service_not_configured" }, 503);
  return json({ ok: true, telegram });
}

export async function handleAegis({ request, supabase }) {
  const params = new URL(request.url).searchParams;
  const action = params.get("action");

  try {
    switch (action) {
      case "status":
        if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
        return await listStatus({ supabase });
      case "logs":
        if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
        return await listLogs({ params, supabase });
      case "ingest":
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
        return await ingest({ request, supabase });
      case "camera-event":
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
        return await cameraEvent({ request, supabase });
      case "test-alert":
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
        return await testAlert({ request });
      default:
        return json({ error: "not_found" }, 404);
    }
  } catch {
    return json({ error: "database_request_failed" }, 503);
  }
}
