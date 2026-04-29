import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface AuthDialogContentProps {
  loginStatus: string;
  loginError: string | null;
  session: { qrDataUrl?: string; status?: string } | null;
  isQRScanning: boolean;
  hasStartedLogin: boolean;
  isConnecting: boolean;
  maxRetriesExceeded: boolean;
  isCheckingCertificates: boolean;
  certificateError: string | null;
  retryCount: number;
  onCheck: () => void;
  onReset: () => void;
  onRetryMobile: () => void;
}

export function AuthDialogContent({
  loginStatus,
  loginError,
  session,
  isQRScanning,
  hasStartedLogin,
  isConnecting,
  maxRetriesExceeded,
  isCheckingCertificates,
  certificateError,
  retryCount,
  onCheck,
  onReset,
  onRetryMobile,
}: AuthDialogContentProps) {
  // QR scanning / authenticating
  if (isQRScanning) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="font-display">
            {loginStatus === 'authenticating' ? 'Verifying...' : 'Scan with your mobile wallet'}
          </DialogTitle>
          <DialogDescription>
            {loginStatus === 'authenticating'
              ? 'Retrieving your identity and certificates'
              : 'Open the wallet app on your phone and scan this code'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {session?.qrDataUrl && loginStatus === 'scanning' ? (
            <>
              <img
                src={session.qrDataUrl}
                alt="Scan to connect mobile wallet"
                className="w-56 h-56 rounded-xl border border-border shadow-sm"
              />
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                session.status === 'connected' ? 'bg-secondary text-green-fresh' : 'bg-muted text-muted-foreground'
              }`}>
                {session.status === 'connected' ? 'Connected' : 'Waiting for scan...'}
              </span>
            </>
          ) : (
            <div className="w-56 h-56 bg-muted rounded-xl animate-pulse" />
          )}
          {loginStatus === 'authenticating' && (
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
          )}
          <Button variant="outline" onClick={onReset} className="w-full mt-2">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Mobile QR error
  if (loginStatus === 'error' && loginError && loginError !== 'NO_CERTIFICATE') {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="font-display">Connection failed</DialogTitle>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertDescription>{loginError}</AlertDescription>
        </Alert>
        <div className="flex flex-col gap-2">
          <Button onClick={onRetryMobile} className="w-full">
            Try Again
          </Button>
          <Button variant="outline" onClick={onReset} className="w-full">
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Max retries exceeded
  if (maxRetriesExceeded) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="font-display">Couldn't connect</DialogTitle>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertDescription>
            Unable to connect to your wallet. Please ensure it's unlocked and try again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="w-full">
          Retry
        </Button>
      </div>
    );
  }

  // Certificate error
  if (certificateError && hasStartedLogin) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="font-display">Verification failed</DialogTitle>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertDescription>{certificateError}</AlertDescription>
        </Alert>
        <Button
          onClick={onCheck}
          disabled={isCheckingCertificates}
          className="w-full"
        >
          {isCheckingCertificates ? 'Checking...' : 'Try Again'}
        </Button>
      </div>
    );
  }

  // Connecting
  if (hasStartedLogin && isConnecting) {
    return (
      <div className="text-center space-y-4 py-4">
        <DialogTitle className="sr-only">Connecting to your wallet</DialogTitle>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <div>
          <p className="font-semibold text-card-foreground">Connecting to your wallet...</p>
          <p className="text-sm text-muted-foreground mt-1">Please approve the connection request</p>
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">Retry attempt {retryCount}...</p>
          )}
        </div>
      </div>
    );
  }

  // Checking certificates
  if (hasStartedLogin && isCheckingCertificates) {
    return (
      <div className="text-center space-y-4 py-4">
        <DialogTitle className="sr-only">Verifying your identity</DialogTitle>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <div>
          <p className="font-semibold text-card-foreground">Verifying your identity...</p>
          <p className="text-sm text-muted-foreground mt-1">Checking your credentials</p>
        </div>
      </div>
    );
  }

  return null;
}
