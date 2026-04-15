import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone, KeyRound, ShieldCheck, Leaf, Fingerprint } from 'lucide-react';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ = [
  {
    value: 'brix',
    icon: Leaf,
    question: 'What is BRIX?',
    answer: (
      <>
        <p>
          BRIX is a community app for tracking and sharing BRIX scores — a simple number that
          reflects how your food was grown. Using a device called a refractometer, anyone can
          measure produce from a farm, market, or store and compare it to readings from around
          the world.
        </p>
        <p className="mt-3">
          The BRIX score measures dissolved solids in fresh produce — primarily sugars — along
          with small amounts of minerals, amino acids, and other compounds. Higher scores often
          indicate a plant that was photosynthesizing well and functioning efficiently, conditions
          commonly associated with better flavour and overall food quality.
        </p>
      </>
    ),
  },
  {
    value: 'wallet',
    icon: KeyRound,
    question: 'What is a wallet?',
    answer: (
      <>
        <p>
          In most apps, your identity is stored on a company's server — which means if they
          get hacked, your account is at risk. In BRIX, a wallet does that job instead.
        </p>
        <p className="mt-3">
          Your wallet is software that lives on your device and holds a cryptographic key that
          is unique to you. When you sign in, your wallet proves your identity to BRIX through
          a cryptographic handshake rather than sending a password. Nobody — including us —
          can access your identity without your direct approval.
        </p>
        <p className="mt-3">
          Think of it as a digital keychain: it unlocks BRIX (and other compatible apps), but
          the key never leaves your device.
        </p>
      </>
    ),
  },
  {
    value: 'identity-key',
    icon: Fingerprint,
    question: 'What is an identity key?',
    answer: (
      <>
        <p>
          Your identity key is a public cryptographic identifier — think of it as a permanent
          username that is mathematically generated from your wallet rather than chosen by you.
        </p>
        <p className="mt-3">
          When you submit a measurement or log in, your wallet uses this key to prove it's
          really you — without sharing a password or personal information with our servers.
          The key is public (anyone can see it), but only you can prove you own it, because
          the matching private key never leaves your device.
        </p>
        <p className="mt-3">
          You can see your identity key in the app — it's a long string of letters and
          numbers. You don't need to memorise it; your wallet handles everything automatically.
          It also means you can use the same identity across any other app that supports
          this standard.
        </p>
      </>
    ),
  },
  {
    value: 'certificate',
    icon: ShieldCheck,
    question: 'What is a certificate?',
    answer: (
      <>
        <p>
          When you create a BRIX account, a small "membership card" called a certificate is
          issued into your wallet. It proves you are a verified BRIX member without sharing
          personal data with us.
        </p>
        <p className="mt-3">
          The certificate is cryptographically signed by BRIX, so the app can confirm your
          membership is genuine — but it contains only what you chose to share (an optional
          display name and email). You control it: it stays in your wallet, and you can
          revoke access at any time simply by removing it.
        </p>
        <p className="mt-3">
          This is why BRIX does not ask for a password — your certificate, stored in your
          wallet, is your proof of membership.
        </p>
      </>
    ),
  },
  {
    value: 'mycelia',
    icon: Smartphone,
    question: 'What is the Mycelia app?',
    answer: (
      <>
        <p>
          Mycelia is the wallet app we recommend for BRIX. It is designed for everyday
          people — no blockchain or crypto knowledge needed. It manages your identity key
          and certificates behind the scenes.
        </p>
        <p className="mt-3">
          Once you have Mycelia set up, opening BRIX from within the app signs you in
          automatically. On a desktop, you can scan a QR code with Mycelia to connect
          without installing anything extra on your computer.
        </p>
        <p className="mt-3">
          Mycelia also works with other compatible apps, so the identity and certificates
          you build here carry across the wider ecosystem.
        </p>
      </>
    ),
  },
];

export default function Help() {
  const navigate = useNavigate();

  return (
    <AuthBackground>
      <div className="w-full max-w-xl mx-auto space-y-6 py-8 pb-20 self-start">

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
          <div className="w-12 h-12 bg-green-fresh rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
          <h1 className="text-2xl font-bold text-text-dark">How BRIX works</h1>
          <p className="text-text-mid text-sm mt-1">Everything you need to know to get started</p>
        </div>

        {/* FAQ accordion */}
        <Accordion type="multiple" defaultValue={['brix']} className="space-y-2">
          {FAQ.map(({ value, icon: Icon, question, answer }) => (
            <AccordionItem
              key={value}
              value={value}
              className="border border-green-pale rounded-xl bg-card overflow-hidden px-4"
            >
              <AccordionTrigger className="hover:no-underline py-4 gap-3 text-left">
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-green-fresh shrink-0" />
                  <span className="font-semibold text-sm text-text-dark">{question}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-text-mid leading-relaxed pb-4">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Getting started */}
        <Card className="border-green-pale bg-green-mist">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-mid">Getting started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ol className="text-sm text-text-dark space-y-2 list-none">
              {[
                'Download the Mycelia app on your phone.',
                'Create your identity inside Mycelia — it only takes a minute.',
                'Open BRIX from within the Mycelia app and you will be signed in automatically.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-fresh text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="pt-2">
              <a
                href="#"
                className="inline-flex items-center gap-2 text-sm font-medium text-green-fresh hover:text-green-mid underline underline-offset-2"
              >
                <Smartphone className="w-4 h-4" />
                Download Mycelia — coming soon
              </a>
            </div>
          </CardContent>
        </Card>

        {/* On desktop */}
        <p className="text-center text-xs text-text-muted pb-4">
          On a desktop? Choose <em>connect via mobile QR</em> on the login screen and scan the code with your Mycelia app.
        </p>

      </div>
    </AuthBackground>
  );
}
