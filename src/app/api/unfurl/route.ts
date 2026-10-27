import { unfurl, UnfurlError } from "@/links/unfurl";

/** GET /api/unfurl?url=… → { title, description, image, siteName } for a link preview card. */
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  try {
    return Response.json(await unfurl(url), { headers: { "cache-control": "private, max-age=86400" } });
  } catch (e) {
    const status = e instanceof UnfurlError ? e.status : 502;
    const error = e instanceof UnfurlError ? e.message : "Couldn't read that page.";
    return Response.json({ error }, { status });
  }
}
