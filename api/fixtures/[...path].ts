/**
 * Vercel Edge-Proxy für fixturedownload.com (CORS, kein Token).
 *
 * Client: GET /api/fixtures/epl-2025
 */
export const config = { runtime: 'edge' }

const UPSTREAM = 'https://fixturedownload.com/feed/json'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'GET' },
    })
  }

  const url = new URL(request.url)
  const prefix = '/api/fixtures/'
  let slug = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : url.pathname.replace(/^\/api\/fixtures\/?/, '')
  slug = decodeURIComponent(slug).replace(/^\/+/, '').replace(/\/+$/, '')

  if (!slug || !/^[a-z0-9-]+-\d{4}$/i.test(slug)) {
    return new Response(JSON.stringify({ error: 'Invalid fixture slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const target = `${UPSTREAM}/${slug}`

  try {
    const upstream = await fetch(target, {
      headers: { Accept: 'application/json' },
    })
    const body = await upstream.arrayBuffer()
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream error'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
