class Dialog {
  constructor({
    id,
    container,
    width,
    height,
    showHeader,
    showClose,
    title,
    onClose
  }) {
    this.id = id;
    this.pageContainer = container || document.body;
    this.title = title;
    this.showHeader = showHeader;
    this.showClose = showClose;
    this.width = width;
    this.height = height;

    this._onClose = onClose && onClose instanceof Function ? onClose : null;

    this.init();
  }

  init() {
    this._shadowHost = document.createElement('div');
    this._shadowHost.id = this.id;
    this.pageContainer.append(this._shadowHost)
    this._shadowDOM = this._shadowHost.attachShadow({
      mode: "open"
    });

    this._dialog = document.createElement('dialog');
    this._dialog.classList.add('ref-dialog');
    this._dialog.style.width = this.width + 'px';

    if (this.height) {
      this._dialog.style.height = this.height + 'px';
    }

    this._dialog.style.borderWidth = 0;
    this._dialog.style.boxShadow = '1px 1px 8px 0 rgba(0,0,0,0.1)';
    this._dialog.style.borderRadius = '8px';
    this._dialog.style.outline = '0';
    this._dialog.style.fontSize = '16px';
    this._dialog.style.color = '#383d40';
    this._shadowDOM.append(this._dialog);

    this._backdrop = document.createElement('div');
    this._backdrop.classList.add('ref-dialog-backdrop');
    this._backdrop.style.display = 'none';
    this._backdrop.style.position = 'fixed';
    this._backdrop.style.top = '0';
    this._backdrop.style.left = '0';
    this._backdrop.style.width = '100%';
    this._backdrop.style.height = '100%';
    this._backdrop.style.backgroundColor = '#edf1f3';
    this._backdrop.style.opacity = '.9';
    this._backdrop.style.zIndex = '9999';
    this._shadowDOM.append(this._backdrop);

    this._container = document.createElement('div');
    this._dialog.appendChild(this._container);

    this._toast = document.createElement('div');
    this._toast.style.display = 'none';
    this._toast.style.position = 'absolute';
    this._toast.style.top = '1em';
    this._toast.style.left = this.width / 4 + 'px';
    this._toast.style.width = this.width / 2 + 'px';
    this._toast.style.fontSize = '.9em';
    this._toast.style.padding = '.8em';
    this._toast.style.textAlign = 'center';
    this._toast.style.borderRadius = '10px';
    this._toast.style.boxShadow = '2px 2px 5px 0 rgba(0, 0, 0, 0.1)';
    this._dialog.appendChild(this._toast);
    this._toastTimeout = null;

    this._state = {};

    this.addEventListeners();
  }

  addEventListeners() {
    this._dialog.addEventListener('close', () => {

      this._backdrop.style.display = 'none';

      if (this._onClose) {
        this._onClose();
      }
    });

    this._dialog.addEventListener('click', (e) => {

      let close = e.target.closest('.ref-dialog-close');
      if (close) {
        this.close();
      }
    });
  }

  open(renderData, onClose) {
    this._shadowHost = document.getElementById(this.id);
    if (!this._shadowHost) return;
    this._dialog = this._shadowHost.shadowRoot.querySelector('dialog');
    if (!this._dialog) return;
    this.render(renderData);
    this._backdrop.style.display = 'block';
    this._dialog.showModal();

    this._onClose = onClose && onClose instanceof Function ? onClose : null;
  }

  close() {
    this._shadowHost = document.getElementById(this.id);
    if (!this._shadowHost) return;
    this._dialog = this._shadowHost.shadowRoot.querySelector('dialog');
    if (!this._dialog) return;
    this._dialog.close();
  }

  render(data) {

    this._container.innerHTML = '';

    if (data) {
      this.state = data;
    }

    if (this.showHeader) {
      var header = document.createElement('div');
      this._container.appendChild(header);
      var title = document.createElement('h3');
      title.style.fontSize = '1.2em';
      title.style.marginTop = '0';
      title.style.marginBottom = '2em';
      title.textContent = this.title;
      header.appendChild(title);
    }

    if (this.showClose) {
      var close = document.createElement('span');
      close.classList.add('ref-dialog-close');
      close.title = 'Close';
      close.style.fontSize = '22px';
      close.style.width = '1.3em';
      close.style.height = '1.3em';
      close.style.textAlign = 'center';
      close.style.cursor = 'pointer';
      close.style.lineHeight = '1.6';
      close.style.background = '#ededed';
      close.style.borderRadius = '50%';
      close.style.position = 'absolute';
      close.style.top = '25px';
      close.style.right = '25px';
      close.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
    </svg>`;
      this._container.appendChild(close);
    }
  }

  showToast({
    type,
    title,
    description
  }) {

    clearTimeout(this._toastTimeout);
    this._toast.innerHTML = '';

    if (type == 'success') {
      this._toast.style.backgroundColor = '#feefcc';
      this._toast.style.border = '1px solid #ead7aa';
      this._toast.style.color = '#644600';
    }
    if (type == 'error') {
      this._toast.style.backgroundColor = '#fde7f2';
      this._toast.style.border = '1px solid #e1cbd6';
      this._toast.style.color = '#b0376e';
    }

    let titleEl = document.createElement('p');
    titleEl.textContent = title;
    titleEl.style.margin = '0';
    this._toast.append(titleEl);

    if (description) {
      let descEl = document.createElement('p');
      descEl.textContent = description;
      descEl.style.margin = '.2em 0 0 0';
      this._toast.append(descEl);
    }

    this._toast.style.display = 'block';

    this._toastTimeout = setTimeout(() => {
      this._toast.style.display = 'none';
    }, 1000 * 5) // 5 seconds

  }
}

export default Dialog;
