export default PaddleManageSubscriptionDialog;
declare class PaddleManageSubscriptionDialog extends Dialog {
    constructor({ auth, onClose }: {
        auth: any;
        onClose: any;
    });
    _auth: any;
    _paddleUpdatePaymentCheckout: Paddle | null | undefined;
    _isLoading: boolean | undefined;
    renderPriceOption(updateOption: any): HTMLDivElement;
    formatAmount(amount: any, currency: any): string;
    formatDate(date: any, format: any): any;
}
import Dialog from './Dialog';
import { Paddle } from '@paddle/paddle-js';
//# sourceMappingURL=PaddleManageSubscriptionDialog.d.ts.map