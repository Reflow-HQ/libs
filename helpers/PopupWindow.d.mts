export default PopupWindow;
declare class PopupWindow {
    constructor({}: {});
    _popupWindow: Window | null;
    _checkPopupWindowClosedInterval: NodeJS.Timeout | null;
    _onParentRefocusCallback: (() => Promise<void>) | null;
    _isCallbackScheduled: boolean;
    _label: any;
    unbind(): void;
    getWindowInstance(): Window | null;
    getLabel(): any;
    setLabel(label: any): void;
    open(options: any): void;
    setURL(url: any): void;
    setOnParentRefocus(onParentRefocus: any): void;
    close(): void;
    cleanup(): void;
    isOpen(): boolean;
    focus(): void;
    isClosed(): boolean;
    offParentRefocus(): void;
}
//# sourceMappingURL=PopupWindow.d.mts.map