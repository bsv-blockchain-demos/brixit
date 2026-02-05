/// <reference types="https://deno.land/x/types/index.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function getGeonamesUsernameFromEnv(): string | null {
  return Deno.env.get('GEONAMES_USERNAME') || Deno.env.get('VITE_GEONAMES_USERNAME')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const username = getGeonamesUsernameFromEnv()
    if (!username) {
      return new Response(
        JSON.stringify({
          error: 'Missing GeoNames username (set GEONAMES_USERNAME or VITE_GEONAMES_USERNAME)',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    const url = new URL(req.url)
    const endpoint = url.searchParams.get('endpoint')
    const paramsB64 = url.searchParams.get('params')

    if (!endpoint) {
      return new Response(JSON.stringify({ username }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (!paramsB64) {
      return new Response(JSON.stringify({ error: 'Missing params' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    let decodedParams: string
    try {
      decodedParams = atob(paramsB64)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid params encoding' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const geonamesUrl = new URL(`https://secure.geonames.org/${endpoint}`)
    const search = new URLSearchParams(decodedParams)
    search.set('username', username)
    geonamesUrl.search = search.toString()

    const geonamesRes = await fetch(geonamesUrl.toString())
    const bodyText = await geonamesRes.text()

    return new Response(bodyText, {
      status: geonamesRes.status,
      headers: {
        'Content-Type': geonamesRes.headers.get('content-type') || 'application/json',
        ...corsHeaders,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
