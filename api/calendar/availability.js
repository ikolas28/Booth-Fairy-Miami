const {
  getValidGmailAccessToken,
  setJson,
  verifyAdminRequest
} = require("../gmail/_lib");

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return setJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  let availabilityWindow = null;
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) {
      return setJson(res, 401, { ok: false, error: "Admin authentication required." });
    }

    const connection = await getValidGmailAccessToken();
    if (!connection) {
      return setJson(res, 400, { ok: false, error: "Google account is not connected yet." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    availabilityWindow = buildAvailabilityWindow(body);
    const availability = await checkFreeBusy(connection.accessToken, availabilityWindow);

    return setJson(res, 200, {
      ok: true,
      calendarId: GOOGLE_CALENDAR_ID,
      date: availabilityWindow.date,
      timeMin: availabilityWindow.timeMin,
      timeMax: availabilityWindow.timeMax,
      available: availability.busy.length === 0,
      busy: availability.busy,
      rule: "Never confirm a booking unless this calendar availability check is clear and deposit/payment status is confirmed."
    });
  } catch (error) {
    return setJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Calendar availability check failed.",
      details: error.details || null,
      request: availabilityWindow ? {
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin: availabilityWindow.timeMin,
        timeMax: availabilityWindow.timeMax,
        timeZone: availabilityWindow.timeZone
      } : null
    });
  }
};

function buildAvailabilityWindow(body) {
  const date = stringify(body.date || body.eventDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("A valid event date is required in YYYY-MM-DD format.");
    error.statusCode = 400;
    throw error;
  }

  const startTime = normalizeTime(body.startTime || "00:00");
  const endTime = normalizeTime(body.endTime || "23:59");
  const timeZone = stringify(body.timeZone) || "America/New_York";

  return {
    date,
    timeZone,
    timeMin: toRfc3339WithOffset(date, startTime, timeZone),
    timeMax: toRfc3339WithOffset(date, endTime, timeZone)
  };
}

async function checkFreeBusy(accessToken, window) {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      timeMin: window.timeMin,
      timeMax: window.timeMax,
      timeZone: window.timeZone,
      items: [{ id: GOOGLE_CALENDAR_ID }]
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Google Calendar free/busy request failed.");
    error.details = payload;
    error.statusCode = response.status;
    throw error;
  }

  return payload?.calendars?.[GOOGLE_CALENDAR_ID] || { busy: [] };
}

function normalizeTime(value) {
  const clean = stringify(value);
  if (/^\d{2}:\d{2}$/.test(clean)) return clean;
  if (/^\d{1}:\d{2}$/.test(clean)) return `0${clean}`;
  const error = new Error("Times must use HH:MM format.");
  error.statusCode = 400;
  throw error;
}

function toRfc3339WithOffset(date, time, timeZone) {
  const offset = getTimeZoneOffset(date, time, timeZone);
  return `${date}T${time}:00${formatOffset(offset)}`;
}

function getTimeZoneOffset(date, time, timeZone) {
  const probe = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(probe);
  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value || "GMT-5";
  const match = zoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return -300;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
}

function formatOffset(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
