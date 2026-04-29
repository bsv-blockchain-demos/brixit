import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { Button } from '@/components/ui/button';
import { Smartphone, HelpCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { BrixLogo } from '@/components/common/BrixLogo';

export default function WalletError() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <AuthBackground>
      <div className="max-w-sm w-full text-center">

        <BrixLogo height="5rem" color="white" className="mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-4">Couldn't connect to your device</h1>

        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm text-text-mid">
              Make sure you open this app via the{' '}
              <button
                onClick={() => navigate('/faq#mycelia')}
                className="font-semibold underline underline-offset-2 text-text-mid hover:text-green-fresh transition-colors"
              >Mycelia</button>{' '}app.
              Don't have it?{' '}
              <a
                href="#"
                className="text-green-fresh hover:text-green-mid underline underline-offset-2"
              >
                Install here
              </a>
            </p>

            <button
              type="button"
              onClick={() => navigate('/faq')}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-mid"
            >
              <HelpCircle className="w-3 h-3" />
              FAQ
            </button>

            {!isMobile && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/login?qr=1')}
                className="w-full gap-2 bg-card"
              >
                <Smartphone className="w-4 h-4" />
                Connect with my phone
              </Button>
            )}
          </CardContent>
        </Card>

      </div>
    </AuthBackground>
  );
}
