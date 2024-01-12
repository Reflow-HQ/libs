export default Dialog;
declare class Dialog {
  constructor({
    width,
    height,
    showHeader,
    showClose,
    title,
    onClose,
  }: {
    width: any;
    height: any;
    showHeader: any;
    showClose: any;
    title: any;
    onClose: any;
  });
  title: any;
  showHeader: any;
  showClose: any;
  width: any;
  height: any;
  _onClose: any;
  init(): void;
  _dialog: HTMLDialogElement | undefined;
  _backdrop: HTMLDivElement | undefined;
  _container: HTMLDivElement | undefined;
  _toast: HTMLDivElement | undefined;
  _toastTimeout: NodeJS.Timeout | null | undefined;
  _state: {} | undefined;
  addEventListeners(): void;
  open(renderData?: any): void;
  close(): void;
  render(data: any): void;
  state: any;
  showToast({ type, title, description }: { type: any; title: any; description: any }): void;
}
//# sourceMappingURL=Dialog.d.ts.map
