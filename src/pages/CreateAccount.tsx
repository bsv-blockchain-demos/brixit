import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { Utils } from '@bsv/sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { API_BASE } from '@/lib/api';
import { AuthBackground } from '@/components/ui/AuthBackground';

const MYCELIA_CERT_TYPE = import.meta.env.VITE_CERT_TYPE || 'Brixit Identity';
const MYCELIA_CERTIFIER_KEY = import.meta.env.VITE_SERVER_PUBLIC_KEY;

type Step = 'checking' | 'details' | 'acquiring';

function friendlyAcquireError(err: any): string {
  // Serialise the full error so we catch server response bodies the SDK may nest deeply
  let raw = '';
  try { raw = JSON.stringify(err); } catch { /* ignore circular refs */ }
  const msg = (raw + ' ' + (err?.message ?? '') + ' ' + String(err)).toLowerCase();

  if (
    msg.includes('nonce') ||
    msg.includes('hmac') ||
    msg.includes('serial') ||
    msg.includes('no certificate received from certifier')
  ) {
    return 'Your wallet could not be verified. This usually means your wallet app is out of date — please update it and try again.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (msg.includes('unauthori') || msg.includes('401')) {
    return 'Authentication failed. Please go back to the login screen and try again.';
  }
  return 'Something went wrong while creating your account. Please try again.';
}

export default function CreateAccount() {
  const { userWallet, userPubKey } = useWallet();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('checking');

  // Block access if the wallet already has a Mycelia certificate
  useEffect(() => {
    if (!userWallet) {
      navigate('/login', { replace: true });
      return;
    }

    let cancelled = false;

    userWallet.listCertificates({
      certifiers: [MYCELIA_CERTIFIER_KEY],
      types: [Utils.toBase64(Utils.toArray(MYCELIA_CERT_TYPE, 'utf8'))],
      limit: 1,
    }).then(result => {
      if (cancelled) return;
      if (result.certificates.length > 0) {
        navigate('/login', { replace: true });
      } else {
        setStep('details');
      }
    }).catch(() => {
      if (!cancelled) setStep('details');
    });

    return () => { cancelled = true; };
  }, [userWallet, navigate]);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function acquireCert(fields: Record<string, string>, fallbackStep: Step = 'details') {
    if (!userWallet || !userPubKey) {
      setError('Wallet not connected. Please go back and try again.');
      return;
    }

    setStep('acquiring');
    setIsLoading(true);
    setError(null);

    try {
      const certType = Utils.toBase64(Utils.toArray(MYCELIA_CERT_TYPE, 'utf8'));

      await (userWallet as any).acquireCertificate({
        type: certType,
        fields,
        acquisitionProtocol: 'issuance',
        certifier: MYCELIA_CERTIFIER_KEY,
        certifierUrl: `${API_BASE}/api/certifier`,
      });

      navigate('/login?autocert=1');
    } catch (err: any) {
      console.error('Certificate acquisition failed:', err);
      setError(friendlyAcquireError(err));
      setStep(fallbackStep);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateNamed(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = { username: username.trim() };
    if (email.trim()) fields.email = email.trim();
    await acquireCert(fields);
  }

  return (
    <AuthBackground>
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-green-deep rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-text-dark">Create your BRIX account</h1>
        </div>

        <Card className="border border-green-pale">
          <CardHeader className="pb-3">
            {step === 'checking' && <CardTitle className="font-display text-text-dark">Checking your wallet…</CardTitle>}
            {(step === 'details' || step === 'acquiring') && (
              <>
                <CardTitle className="font-display text-text-dark">Create your account</CardTitle>
                <CardDescription className="text-text-mid">Choose a username and optionally add your email.</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 'checking' && (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-fresh" />
              </div>
            )}

            {step === 'details' && (
              <form onSubmit={handleCreateNamed} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="username">Display Name</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Your display name"
                    maxLength={50}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email <span className="text-text-muted-green font-normal">(optional)</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-green-fresh hover:bg-green-mid text-white"
                  disabled={isLoading || !username.trim()}
                >
                  {isLoading ? 'Creating…' : 'Create account'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  Back
                </Button>
              </form>
            )}

            {step === 'acquiring' && (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-fresh mx-auto mb-4" />
                <p className="text-text-mid">Issuing your identity certificate…</p>
                <p className="text-sm text-text-muted-green mt-1">Please approve the request in your wallet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthBackground>
  );
}
