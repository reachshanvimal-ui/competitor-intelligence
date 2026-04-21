/**
 * /api/logo — proxies Clearbit logo API so the browser can fetch
 * company logos without CORS issues.
 */
export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  const url    = new URL(request.url);
  const domain = url.searchParams.get("domain") || "";

  if (!domain || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) {
    return new Response("Invalid domain", { status: 400 });
  }

  try {
    const resp = await fetch(`https://logo.clearbit.com/${domain}?size=120`, {
      headers: { "User-Agent": "competitor-intel/1.0" },
    });
    if (!resp.ok) return new Response("Logo not found", { status: 404 });

    const buf = await resp.arrayBuffer();
    const ct  = resp.headers.get("content-type") || "image/png";
    return new Response(buf, {
      headers: { "Content-Type": ct, "Cache-Control": "public, max-age=604800", ...cors() },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
};

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
}

export const config = { path: "/api/logo" };
