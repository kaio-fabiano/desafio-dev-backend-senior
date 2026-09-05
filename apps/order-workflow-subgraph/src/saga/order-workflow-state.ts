export enum OrderWorkflowState {
  Created = 'CREATED',
  PaymentPending = 'PAYMENT_PENDING',
  PaymentAuthorized = 'PAYMENT_AUTHORIZED',
  StockPending = 'STOCK_PENDING',
  Completed = 'COMPLETED',
  StockFailed = 'STOCK_FAILED',
  RefundPending = 'REFUND_PENDING',
  Refunded = 'REFUNDED',
  Cancelled = 'CANCELLED',
  PixPending = 'PIX_PENDING',
  PixGenerated = 'PIX_GENERATED',
}
