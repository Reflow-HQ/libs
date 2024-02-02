export default Dialog;
declare class Dialog {
  constructor({
    id,
    container,
    width,
    height,
    showHeader,
    showClose,
    title,
    onClose,
  }: {
    id: any;
    container: any;
    width: any;
    height: any;
    showHeader: any;
    showClose: any;
    title: any;
    onClose: any;
  });
  id: any;
  pageContainer: any;
  title: any;
  showHeader: any;
  showClose: any;
  width: any;
  height: any;
  _onClose: any;
  init(): void;
  _shadowHost: HTMLElement | HTMLDivElement | null | undefined;
  _shadowDOM: ShadowRoot | undefined;
  _dialog: HTMLDialogElement | null | undefined;
  _backdrop: HTMLDivElement | undefined;
  _container: HTMLDivElement | undefined;
  _toast: HTMLDivElement | undefined;
  _toastTimeout: NodeJS.Timeout | null | undefined;
  state: {};
  addEventListeners(): void;
  recordEventListener(): void;
  open(renderData?: any, onClose?: any): void;
  close(): void;
  render(data: any): void;
  state: any;
  showToast({ type, title, description }: { type: any; title: any; description: any }): void;
}
//# sourceMappingURL=Dialog.d.ts.map
