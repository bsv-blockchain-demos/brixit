import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function WalletError() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          <CardTitle className="text-center text-2xl">Wallet Connection Failed</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            We couldn't connect to your BSV wallet. Please ensure:
          </p>
          <ul className="text-left text-sm text-gray-600 space-y-2">
            <li>• Your wallet extension is installed and unlocked</li>
            <li>• You have a compatible BSV wallet (Panda Wallet, etc.)</li>
            <li>• You've granted the necessary permissions</li>
          </ul>
          <Button
            onClick={() => window.location.href = '/login'}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Try Again
          </Button>
          <p className="text-xs text-gray-500">
            Need help? <a href="mailto:support@brixit.app" className="text-green-600 hover:underline">Contact Support</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
