import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { REJECTION_TEMPLATES } from '../../lib/rejectionReasons';

interface RejectSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (message: string) => void;
  busy?: boolean;
}

const RejectSubmissionDialog: React.FC<RejectSubmissionDialogProps> = ({
  open, onOpenChange, onConfirm, busy = false,
}) => {
  const [message, setMessage] = useState('');

  // Each rejection starts from a clean box rather than the previous reason.
  useEffect(() => {
    if (open) setMessage('');
  }, [open]);

  const canSubmit = message.trim().length > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject this submission</DialogTitle>
          <DialogDescription>
            The contributor sees this reason and can correct their reading and send it back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Common reasons</Label>
            <div className="flex flex-wrap gap-2">
              {REJECTION_TEMPLATES.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => setMessage(template)}
                  className="rounded-lg border border-hairline px-3 py-1.5 text-xs text-text-mid hover:bg-surface-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejection-message">Reason</Label>
            <Textarea
              id="rejection-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Explain what needs to change."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(message.trim())} disabled={!canSubmit}>
            {busy ? 'Rejecting...' : 'Reject submission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RejectSubmissionDialog;
