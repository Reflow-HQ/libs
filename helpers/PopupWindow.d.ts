export default PopupWindow;
declare class PopupWindow {
    constructor({}: {});
    _popupWindow: Window | null;
    _checkPopupWindowClosedInterval: any;
    _checkPageRefocusInterval: any;
    unbind(): void;
    getWindowInstance(): Window | null;
    open(options: any): void;
    setURL(url: any): void;
    close(): void;
    isOpen(): boolean;
    isClosed(): boolean;
    startPageRefocusInterval(options: any): void;
    stopPageRefocusInterval(): void;
}
//# sourceMappingURL=PopupWindow.d.ts.map