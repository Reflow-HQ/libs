export default PaddleManageSubscriptionDialog;
declare class PaddleManageSubscriptionDialog extends Dialog {
  constructor({
    container,
    updatePlan,
    cancelSubscription,
  }: {
    container: any;
    updatePlan: any;
    cancelSubscription: any;
  });
  _updatePlan: any;
  _cancelSubscription: any;
  _paddleUpdatePaymentCheckout: import("@paddle/paddle-js").Paddle | null | undefined;
  _isLoading: boolean | undefined;
  renderPriceOption(updateOption: any): HTMLDivElement;
  formatAmount(amount: any, currency: any): string;
  formatDate(date: any, format: any): any;
}
import Dialog from "./Dialog.mjs";
//# sourceMappingURL=PaddleManageSubscriptionDialog.d.ts.map
