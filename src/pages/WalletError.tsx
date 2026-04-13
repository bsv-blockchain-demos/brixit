import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { Button } from '@/components/ui/button';
import { Smartphone, HelpCircle } from 'lucide-react';

export default function WalletError() {
  const navigate = useNavigate();

  return (
    <AuthBackground>
      <div className="max-w-sm w-full text-center">

        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-white font-bold text-2xl">B</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-4">Couldn't connect to your device</h1>

        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm text-gray-600">
              Make sure you open this app via the <strong>Mycelia</strong> app.
              Don't have it?{' '}
              <a
                href="#"
                className="text-green-600 hover:text-green-700 underline underline-offset-2"
              >
                Install here
              </a>
            </p>

            <button
              type="button"
              onClick={() => navigate('/help')}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <HelpCircle className="w-3 h-3" />
              How it works
            </button>

            <p className="text-xs text-gray-400">
              or{' '}
              <button
                type="button"
                onClick={() => navigate('/login?qr=1')}
                className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                <Smartphone className="w-3 h-3" />
                connect via mobile QR
              </button>
            </p>
          </CardContent>
        </Card>

      </div>
    </AuthBackground>
  );
}
