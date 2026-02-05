/// <reference types="https://deno.land/x/types/index.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Certificate as BsvCertificate } from 'npm:@bsv/sdk@1.10.3'

// Type definitions
interface CertificateDTO {
  certifier: string
  serialNumber: string
  type: string
  subject?: unknown
  revocationOutpoint?: unknown
  fields?: unknown
  signature?: unknown
  [key: string]: any
}

interface UserData {
  displayName: string
  description?: string
  locationLat: number
  locationLng: number
  email?: string
  phoneNumber?: string
}

interface WalletAuthRequest {
  identityKey: string
  certificateSerialNumber: string
  certificate: CertificateDTO
  userData: UserData
}

interface LocationData {
  country: string
  state: string
  city: string
}

const REQUIRED_CERTIFIER = Deno.env.get('COMMONSOURCE_SERVER_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const body = await req.json() as WalletAuthRequest
    const { identityKey, certificateSerialNumber, certificate, userData } = body

    // 1. Validate input
    if (!identityKey || !certificateSerialNumber || !certificate || !userData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      })
    }

    // 2. Verify certificate issuer (MVP: basic check)
    if (certificate.certifier !== REQUIRED_CERTIFIER) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid certificate issuer'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      })
    }

    // Build certificate from request
    const cert = new BsvCertificate(
      certificate.type,
      certificate.serialNumber,
      certificate.subject,
      certificate.certifier,
      certificate.revocationOutpoint,
      certificate.fields,
      certificate.signature,
    )
    // Verify certificate
    const valid = await cert.verify()

    if (!valid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid certificate signature'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 3. Reverse-geocode lat/lng using GeoNames
    const location = await reverseGeocode(userData.locationLat, userData.locationLng)

    // 4. Check if wallet identity exists
    const { data: existingIdentity } = await supabaseAdmin
      .from('wallet_identities')
      .select('user_id')
      .eq('identity_key', identityKey)
      .maybeSingle()

    let userId: string
    const identityKeyShort = typeof identityKey === 'string' ? identityKey.slice(0, 32) : 'unknown'
    const authEmail = userData.email || `wallet-${identityKeyShort}@brixit.example`

    if (existingIdentity) {
      // Existing user - update verification timestamp
      userId = existingIdentity.user_id

      await supabaseAdmin
        .from('wallet_identities')
        .update({
          certificate_serial: certificateSerialNumber,
          last_verified_at: new Date().toISOString()
        })
        .eq('identity_key', identityKey)

    } else {
      // New user - create auth user + mapping
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        phone: userData.phoneNumber,
        email_confirm: true,
        user_metadata: {
          display_name: userData.displayName,
          wallet_identity: true
        }
      })

      if (authError) throw authError
      userId = authUser.user.id

      await supabaseAdmin
        .from('wallet_identities')
        .insert({
          identity_key: identityKey,
          user_id: userId,
          certificate_serial: certificateSerialNumber,
          last_verified_at: new Date().toISOString()
        })
    }

    // 5. Upsert user profile
    await supabaseAdmin
      .from('users')
      .update({
        display_name: userData.displayName,
        country: location.country,
        state: location.state,
        city: location.city,
        location_lat: userData.locationLat,
        location_lng: userData.locationLng
      })
      .eq('id', userId)

    // 6. Fetch user roles
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    const roleNames = roles?.map((r: { role: string }) => r.role) || ['viewer']

    // 7. Generate session tokens
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
    })

    if (linkError) throw linkError

    const hashedToken = (linkData as any)?.properties?.hashed_token
    if (hashedToken) {
      const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'magiclink',
      } as any)

      if (verifyError) throw verifyError

      const session = (verifyData as any)?.session
      if (session?.access_token && session?.refresh_token) {
        return new Response(JSON.stringify({
          success: true,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in || 3600,
          token_type: session.token_type || 'bearer',
          user: {
            id: userId,
            display_name: userData.displayName,
            roles: roleNames,
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          }
        })
      }
    }

    // Fallback: Extract tokens from magic link (query or hash)
    const url = new URL((linkData as any).properties.action_link)
    const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
    const accessToken = url.searchParams.get('access_token') || hashParams.get('access_token')
    const refreshToken = url.searchParams.get('refresh_token') || hashParams.get('refresh_token')

    if (!accessToken || !refreshToken) {
      throw new Error('Failed to generate session tokens')
    }

    return new Response(JSON.stringify({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: userId,
        display_name: userData.displayName,
        roles: roleNames,
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      }
    })

  } catch (error) {
    console.error('wallet-auth-verify error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      }
    })
  }
})

async function reverseGeocode(lat: number, lng: number): Promise<LocationData> {
  // Use existing GeoNames proxy pattern
  const geonamesUrl = `${SUPABASE_URL}/functions/v1/get-geonames-username`
  const params = btoa(new URLSearchParams({
    lat: String(lat),
    lng: String(lng)
  }).toString())

  const response = await fetch(
    `${geonamesUrl}?endpoint=findNearbyPlaceNameJSON&params=${encodeURIComponent(params)}`,
    {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    }
  )

  if (!response.ok) {
    console.error('Geocoding failed:', await response.text())
    throw new Error('Geocoding failed')
  }

  const data = await response.json()

  if (data.geonames && data.geonames.length > 0) {
    const place = data.geonames[0]
    return {
      country: place.countryName || 'Unknown',
      state: place.adminName1 || '',
      city: place.name || ''
    }
  }

  return { country: 'Unknown', state: '', city: '' }
}
