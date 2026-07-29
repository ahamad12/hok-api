export const SOCKET_EVENTS = {
  TASK_ASSIGNED: "task:assigned",
  TASK_UPDATED: "task:updated",

  TICKET_CREATED: "ticket:created",
  TICKET_UPDATED: "ticket:updated",
  TICKET_MESSAGE_CREATED: "ticket:message_created",

  TILL_ENTRY_CREATED: "till:created",

  SCRATCH_SALE_CREATED: "scratch:sale_created",

  DELIVERY_CREATED: "delivery:created",

  DAILY_SUMMARY_FINALIZED: "summary:finalized",

  LICENSE_EXPIRING: "license:expiring",

  PROFIT_REPORT_GENERATED: "report:generated",

  FORM_SUBMITTED: "form:submitted",

  SESSION_REVOKED: "session:revoked",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
