// Vercel Function: fetches a remote iCalendar feed server-side so the browser
// isn't blocked by CORS (portal.sbl.ch / Outlook don't send CORS headers).
// It only ever returns iCalendar data, so it can't be abused as a generic proxy.

const MAX_BYTES = 15 * 1024 * 1024;

export async function GET(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return json(400, { error: 'Missing ?url=' });

  let url: URL;
  try {
    url = new URL(target.replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    return json(400, { error: 'Invalid URL' });
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return json(400, { error: 'Only http(s) and webcal links are supported' });
  }
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) {
    return json(400, { error: 'Private addresses are not allowed' });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'StudentPlanner/1.0 (+calendar sync)',
        Accept: 'text/calendar, text/plain, */*',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      return json(502, { error: `Calendar server answered ${upstream.status}` });
    }
    const text = await upstream.text();
    if (text.length > MAX_BYTES) return json(413, { error: 'Calendar is too large' });
    if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 4096))) {
      return json(422, { error: 'That link did not return an iCalendar (.ics) feed' });
    }
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'private, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json(504, { error: `Could not reach the calendar server (${msg})` });
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
