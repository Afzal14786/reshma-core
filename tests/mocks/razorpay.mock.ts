// ──────────────────────────────────────────────
// Razorpay SDK mock — no real API calls during tests
// ──────────────────────────────────────────────

let orderCounter = 0;

export const razorpay = {
  orders: {
    create: jest.fn(
      async (opts: {
        amount: number;
        currency: string;
        receipt: string;
        notes?: Record<string, string>;
      }) => {
        orderCounter += 1;
        return {
          id: `order_test_${Date.now()}_${orderCounter}`,
          entity: "order",
          amount: opts.amount,
          amount_paid: 0,
          amount_due: opts.amount,
          currency: opts.currency,
          receipt: opts.receipt,
          status: "created",
          notes: opts.notes ?? {},
          created_at: Math.floor(Date.now() / 1000),
        };
      },
    ),
  },
  payments: {
    refund: jest.fn(async () => ({
      id: `rfnd_test_${Date.now()}`,
      entity: "refund",
      amount: 0,
      status: "processed",
    })),
  },
};

export default razorpay;

export function __resetRazorpayMock(): void {
  orderCounter = 0;
  razorpay.orders.create.mockClear();
  razorpay.payments.refund.mockClear();
}