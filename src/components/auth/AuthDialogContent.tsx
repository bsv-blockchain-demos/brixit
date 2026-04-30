import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface AuthDialogContentProps {
  hasStartedLogin: boolean;
  isConnecting: boolean;
  maxRetriesExceeded: boolean;
  isCheckingCertificates: boolean;
  certificateError: string | null;
  retryCount: number;
  onCheck: () => void;
  onReset: () => void;
}

export function AuthDialogContent({
  hasStartedLogin,
  isConnecting,
  maxRetriesExceeded,
  isCheckingCertificates,
  certificateError,
  retryCount,
  onCheck,
  onReset,
}: AuthDialogContentProps) {
  // Max retries exceeded
  if (maxRetriesExceeded) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="font-display">Couldn't connect</DialogTitle>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertDescription>
            Unable to connect to your desktop wallet. Make sure it's unlocked and try again.
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

  // Connecting to desktop wallet
  if (hasStartedLogin && isConnecting) {
    return (
      <div className="text-center space-y-4 py-4">
        <DialogTitle className="sr-only">Connecting to your wallet</DialogTitle>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <div>
          <p className="font-semibold text-card-foreground">Connecting...</p>
          <p className="text-sm text-muted-foreground mt-1">Please approve the connection request in your desktop wallet</p>
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">Retry attempt {retryCount}…</p>
          )}
        </div>
        <Button variant="outline" onClick={onReset} className="w-full mt-2">
          Cancel
        </Button>
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
