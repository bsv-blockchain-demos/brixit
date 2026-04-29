import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
          A fresh carrot from a well-managed farm and one from an industrial supermarket
          shelf look identical — but they may taste completely different and reflect very
          different growing conditions. Until now, there was no simple way for ordinary
          people to measure this difference. BRIX gives you that number.
        </p>
        <p className="mt-3">
          BRIX is a community app for tracking and sharing BRIX scores — a simple number
          that reflects how your food was grown. Using a device called a refractometer,
          anyone can measure produce from a farm, market, or store and compare it to
          readings from around the world.
        </p>
        <p className="mt-3">
          The BRIX score measures dissolved solids in fresh produce — primarily sugars —
          along with small amounts of minerals, amino acids, and other compounds. Higher
          scores often indicate a plant that was photosynthesizing well and functioning
          efficiently, conditions commonly associated with better flavour and overall food
          quality.
        </p>
      </>
    ),
  },
  {
    value: 'wallet',
    icon: KeyRound,
    question: 'Why do we use a wallet instead of a password?',
    answer: (
      <>
        <p>
          When you create an account with an email and password, that password is stored
          on a company's server. If that server gets breached — and major services are
          breached every year — your credentials are exposed. We didn't want to build yet
          another database of passwords that could be leaked, sold, or misused.
        </p>
        <p className="mt-3">
          Instead, your identity lives only on your own device inside a wallet — software
          that holds a cryptographic key unique to you. When you sign in, your wallet
          proves your identity through a cryptographic handshake rather than sending a
          password. Nobody, including us, can access your account without your approval.
        </p>
        <p className="mt-3">
          Think of it as a digital keychain: it unlocks BRIX (and other compatible apps),
          but the key never leaves your device and there is no password for anyone to steal.
        </p>
      </>
    ),
  },
  {
    value: 'identity-key',
    icon: Fingerprint,
    question: 'What is an identity key and why do we need one?',
    answer: (
      <>
        <p>
          To keep submissions trustworthy, BRIX needs to know that different measurements
          come from the same person — to prevent spam and duplicate accounts. But we don't
          need to know <em>who</em> that person is, just that they're consistent. An
          identity key solves this: it lets you prove continuity of identity without
          revealing personal information.
        </p>
        <p className="mt-3">
          Your identity key is a public cryptographic identifier — a permanent username
          mathematically generated from your wallet. Your submissions are linked to your
          key, not your name. The key is public (anyone can see it), but only you can
          prove you own it, because the matching private key never leaves your device.
        </p>
        <p className="mt-3">
          You don't need to memorise it — your wallet handles everything automatically.
          It also means you can use the same identity across any other app that supports
          this standard.
        </p>
      </>
    ),
  },
  {
    value: 'certificate',
    icon: ShieldCheck,
    question: 'What is a certificate and why does BRIX use one?',
    answer: (
      <>
        <p>
          Knowing that an identity key exists isn't enough — BRIX also needs to confirm
          it belongs to a genuine, verified member rather than a bot or spammer. The
          traditional approach is to maintain a list of approved users in a database on
          our servers — but that's another database to protect, and another breach waiting
          to happen. A certificate solves this without us holding anything.
        </p>
        <p className="mt-3">
          When you create a BRIX account, we issue a cryptographic membership certificate
          directly into your wallet. It's cryptographically signed by BRIX, so the app
          can verify your membership is genuine without looking anything up on our servers.
          It contains only what you chose to share — an optional display name and email.
        </p>
        <p className="mt-3">
          You control it entirely: it stays in your wallet, and you can revoke access at
          any time by removing it. This is why BRIX has no password — your certificate
          is your proof of membership.
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
          Managing cryptographic keys safely is genuinely difficult. Done badly it creates
          security holes; done well, it requires software that most people don't know how
          to set up. We wanted people to use BRIX without becoming cryptography experts —
          so we chose to build on Mycelia, an existing wallet app that handles all the
          complexity for you.
        </p>
        <p className="mt-3">
          Mycelia is designed for everyday people — no blockchain or crypto knowledge
          needed. It manages your identity key and certificates behind the scenes. Once
          set up, opening BRIX from within the app signs you in automatically. On a
          desktop, you can scan a QR code with Mycelia to connect without installing
          anything extra on your computer.
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
  const location = useLocation();

  const hashSection = location.hash.replace('#', '');
  const validHash = FAQ.some(f => f.value === hashSection) ? hashSection : null;
  const defaultOpen = validHash ? [validHash] : ['brix'];

  useEffect(() => {
    if (!validHash) return;
    const el = document.getElementById(validHash);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [validHash]);

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
          <h1 className="text-2xl font-bold text-white">How BRIX works</h1>
          <p className="text-on-bg-body text-sm mt-1">Everything you need to know to get started</p>
        </div>

        {/* FAQ accordion */}
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
          {FAQ.map(({ value, icon: Icon, question, answer }) => (
            <AccordionItem
              key={value}
              value={value}
              id={value}
              className="border border-blue-pale rounded-xl bg-card overflow-hidden px-4"
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
        <Card className="border-blue-pale bg-blue-mist">
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
