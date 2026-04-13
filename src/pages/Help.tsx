import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone, KeyRound, ShieldCheck, Leaf } from 'lucide-react';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const sections = [
  {
    icon: Leaf,
    title: 'What is BRIX?',
    body: `BRIX is a community app for tracking and sharing bionutrient scores — a measure of how nutritious food really is. Using a simple device called a refractometer, anyone can submit a reading from a farm, market, or store and see how it compares to others around the world.`,
  },
  {
    icon: KeyRound,
    title: 'What is a wallet?',
    body: `In most apps you log in with an email and password. In BRIX, a wallet does that job instead — but much more securely. Think of it as a digital keychain that lives on your device. It holds your identity, and nobody (not even us) can access it without your approval. No passwords to forget, no accounts to hack.`,
  },
  {
    icon: ShieldCheck,
    title: 'What is a certificate?',
    body: `When you create a BRIX account, a small "membership card" called a certificate is stored in your wallet. It proves you are a real BRIX member without sharing personal data with us. It stays private — only you control it, and you can revoke it at any time.`,
  },
  {
    icon: Smartphone,
    title: 'What is the Mycelia app?',
    body: `Mycelia is the wallet app we recommend for BRIX. It is designed for everyday people — no crypto knowledge needed. It manages your identity and certificate behind the scenes, so getting into BRIX is as simple as opening the app.`,
  },
];

export default function Help() {
  const navigate = useNavigate();

  return (
    <AuthBackground>
      <div className="w-full max-w-xl mx-auto space-y-6 py-8 self-start">

        {/* Back */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">How BRIX works</h1>
          <p className="text-gray-500 text-sm mt-1">Everything you need to know to get started</p>
        </div>

        {/* Info sections */}
        {sections.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="w-5 h-5 text-green-600 shrink-0" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
            </CardContent>
          </Card>
        ))}

        {/* Getting started */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-800">Getting started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ol className="text-sm text-green-900 space-y-2 list-none">
              {[
                'Download the Mycelia app on your phone.',
                'Create your identity inside Mycelia — it only takes a minute.',
                'Open BRIX from within the Mycelia app and you will be signed in automatically.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="pt-2">
              <a
                href="#"
                className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800 underline underline-offset-2"
              >
                <Smartphone className="w-4 h-4" />
                Download Mycelia — coming soon
              </a>
            </div>
          </CardContent>
        </Card>

        {/* On desktop */}
        <p className="text-center text-xs text-gray-400 pb-4">
          On a desktop? You can still sign in by choosing <em>connect via mobile QR</em> on the login screen and scanning the code with your Mycelia app.
        </p>

      </div>
    </AuthBackground>
  );
}
