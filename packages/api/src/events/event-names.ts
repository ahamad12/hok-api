export const SOCKET_EVENTS = {
  TASK_ASSIGNED: "task:assigned",
  TASK_UPDATED: "task:updated",

  TICKET_CREATED: "ticket:created",
  TICKET_UPDATED: "ticket:updated",
  TICKET_MESSAGE_CREATED: "ticket:message_created",
  TICKET_STATUS_CHANGED: "ticket:status_changed",
  TICKET_ASSIGNED: "ticket:assigned",
  TICKET_ACKNOWLEDGED: "ticket:acknowledged",

  TILL_ENTRY_CREATED: "till:created",

  SCRATCH_SALE_CREATED: "scratch:sale_created",

  DELIVERY_CREATED: "delivery:created",

  DAILY_SUMMARY_FINALIZED: "summary:finalized", // CORRECTED — was wrongly written as "daily_summary:finalized"; this constant already existed, don't duplicate it
  DAILY_SUMMARY_VOIDED: "summary:voided", // NEW

  LICENSE_EXPIRING: "license:expiring",

  PROFIT_REPORT_GENERATED: "report:generated",
  PROFIT_REPORT_VOIDED: "report:voided",

  FORM_SUBMITTED: "form:submitted",

  SESSION_REVOKED: "session:revoked",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
