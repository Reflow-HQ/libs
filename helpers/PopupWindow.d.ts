export default PopupWindow;
declare class PopupWindow {
    constructor({}: {});
    _popupWindow: Window | null;
    _checkPopupWindowClosedInterval: any;
    _onParentRefocusCallback: any;
    unbind(): void;
    getWindowInstance(): Window | null;
    open(options: any): void;
    setURL(url: any): void;
    close(): void;
    isOpen(): boolean;
    isClosed(): boolean;
    offParentRefocus(): void;
}
//# sourceMappingURL=PopupWindow.d.ts.map