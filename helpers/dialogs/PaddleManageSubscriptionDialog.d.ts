export default PaddleManageSubscriptionDialog;
declare class PaddleManageSubscriptionDialog extends Dialog {
    constructor({ container, popupWindow, fullResetFunction, updatePlan, onClose, }: {
        container: any;
        popupWindow: any;
        fullResetFunction: any;
        updatePlan: any;
        onClose: any;
    });
    _popupWindow: any;
    _fullResetFunction: any;
    _updatePlan: any;
    _paddleUpdatePaymentCheckout: Paddle | null | undefined;
    _isLoading: boolean | undefined;
    render(data: any): void;
    renderPriceOption(updateOption: any): HTMLDivElement;
    formatAmount(amount: any, currency: any): string;
    formatDate(date: any, format: any): any;
}
import Dialog from './Dialog';
import { Paddle } from '@paddle/paddle-js';
//# sourceMappingURL=PaddleManageSubscriptionDialog.d.ts.map