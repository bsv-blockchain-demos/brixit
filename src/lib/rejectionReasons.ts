/**
 * Starting points for an admin's rejection reason. Selecting one fills the
 * message box, which stays freely editable — these are a shortcut, not a
 * fixed vocabulary, so nothing validates against this list.
 */
export const REJECTION_TEMPLATES = [
  'BRIX value reading too high for this crop',
  'BRIX value reading too low for this crop',
  'Crop type does not match the reading',
  'Location or store details look incorrect',
  'Duplicate of an existing submission',
] as const;
