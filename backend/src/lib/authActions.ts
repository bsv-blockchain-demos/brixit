/**
 * Action strings a caller signs to authorize a write. The value is the string
 * `verifyAuthProof` compares against, so each one must match the frontend table
 * in `src/lib/authProofRoutes.ts` exactly.
 */
export const AUTH_ACTIONS = {
    adminRolesGrant: 'admin-roles-grant',
    adminRolesRevoke: 'admin-roles-revoke',
    adminVerify: 'admin-verify',
    adminReject: 'admin-reject',
    adminDelete: 'admin-delete',
    submissionCreate: 'submission-create',
    submissionRetryAnchor: 'submission-retry-anchor',
    submissionResubmit: 'submission-resubmit',
    submissionEdit: 'submission-edit',
    submissionDelete: 'submission-delete',
} as const;

export type AuthAction = (typeof AUTH_ACTIONS)[keyof typeof AUTH_ACTIONS];
