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
    cleanup(): void;
    isOpen(): boolean;
    focus(): void;
    isClosed(): boolean;
    offParentRefocus(): void;
}
//# sourceMappingURL=PopupWindow.d.mts.map