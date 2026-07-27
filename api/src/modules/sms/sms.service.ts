// One SmsService interface, two implementations (Africa's Talking / console stub)
// selected by SMS_DRIVER — the same swappable-provider pattern as mail/push. SMS
// suits drivers better than email in the Rwanda context (accessible, familiar).
export const SMS_SERVICE = 'SMS_SERVICE';

export interface SmsService {
  // `to` is an E.164 Rwanda number (+2507…). Best-effort — implementations must
  // never throw into the caller; SMS is a delight, not a dependency.
  send(to: string, message: string): Promise<void>;
}
