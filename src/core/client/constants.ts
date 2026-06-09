 type DisconnectAction = 'stop' | 'reconnect' | 'retry' | 'clear';

 type DisconnectReasonConfig = {
  label: string;
  action: DisconnectAction;
  delay?: number;
  limit?: number;
}

export const REASON_MAP: Record<number, DisconnectReasonConfig> = {
  401: { label: 'Logged Out', action: 'clear' },
  403: { label: 'Forbidden (Banned?)', action: 'clear' },
  408: {
    // connectionLost + timedOut
    label: 'Connection Lost / Timed Out',
    action: 'reconnect',
    delay: 5000,
  },
  411: {
    label: 'Multi-device Mismatch',
    action: 'retry',
    delay: 5000,
    limit: 2,
  },
  428: { label: 'Connection Closed', action: 'reconnect', delay: 5000 },
  440: { label: 'Connection Replaced', action: 'stop' },
  500: { label: 'Bad Session', action: 'clear' },
  503: {
    label: 'Service Unavailable',
    action: 'reconnect',
    delay: 5000,
    limit: 5,
  },
  515: { label: 'Restart Required', action: 'reconnect', delay: 3000 },
};
