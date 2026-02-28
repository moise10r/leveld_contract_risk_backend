export enum ClauseType {
  LIABILITY = 'liability',
  INTELLECTUAL_PROPERTY = 'ip',
  TERMINATION = 'termination',
  PAYMENT = 'payment',
  CHANGE_CONTROL = 'change-control',
  CONFIDENTIALITY = 'confidentiality',
  INDEMNIFICATION = 'indemnification',
  WARRANTY = 'warranty',
  DISPUTE_RESOLUTION = 'dispute-resolution',
  GOVERNING_LAW = 'governing-law',
  FORCE_MAJEURE = 'force-majeure',
  OTHER = 'other',
}

export const CLAUSE_TYPE_LABELS: Record<ClauseType, string> = {
  [ClauseType.LIABILITY]: 'Liability',
  [ClauseType.INTELLECTUAL_PROPERTY]: 'Intellectual Property',
  [ClauseType.TERMINATION]: 'Termination',
  [ClauseType.PAYMENT]: 'Payment',
  [ClauseType.CHANGE_CONTROL]: 'Change Control',
  [ClauseType.CONFIDENTIALITY]: 'Confidentiality',
  [ClauseType.INDEMNIFICATION]: 'Indemnification',
  [ClauseType.WARRANTY]: 'Warranty',
  [ClauseType.DISPUTE_RESOLUTION]: 'Dispute Resolution',
  [ClauseType.GOVERNING_LAW]: 'Governing Law',
  [ClauseType.FORCE_MAJEURE]: 'Force Majeure',
  [ClauseType.OTHER]: 'Other',
};
