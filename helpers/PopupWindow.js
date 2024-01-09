class PopupWindow {
  constructor({}) {
    this._popupWindow = null;
    this._checkPopupWindowClosedInterval = null;
    this._checkPageRefocusInterval = null;
  }

  unbind() {
    clearInterval(this._checkPopupWindowClosedInterval);
    clearInterval(this._checkPageRefocusInterval);
  }

  getWindowInstance() {
    return this._popupWindow;
  }

  open(options) {

    if (this._popupWindow) {
      // Already open
      this._popupWindow.focus();
      return;
    }

    const {
      url,
      label,
      title,
    } = options;

    const {
      w,
      h
    } = options.size;
    const y = window.outerHeight / 2 + window.screenY - h / 2;
    const x = window.outerWidth / 2 + window.screenX - w / 2;

    this._popupWindow = window.open(
      url || "about:blank",
      label,
      `width=${w},height=${h},top=${y},left=${x}`
    );

    if (this._popupWindow) {
      this._popupWindow.document.write(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
                <style>
    * {
      box-sizing: border-box;
    }
    
    html, body {
      margin: 0;
      padding: 0;
    }
    
    html {
      color:#333;
      background:#fff;
    }
    
    .loader {
      position: fixed;
      left: 50%;
      top: 50%;
      margin-left: -24px;
      margin-top: -40px;
    
      width: 48px;
      height: 48px;
      border: 5px solid currentColor;
      border-bottom-color: transparent;
      border-radius: 50%;
      display: inline-block;
      animation: rotation 1s linear infinite;
    }
    
    @keyframes rotation {
      0% {
          transform: rotate(0deg);
      }
      100% {
          transform: rotate(360deg);
      }
    }
    
    @media (prefers-color-scheme: dark) {
      html {
        background: #141415;
        color: #fff;
      }
    }
        </style>
            </head>
          <body><span class="loader"></span></body>
        </html>`);
    }

    // This interval cleans up the _popupWindow after the popup window is closed.

    clearInterval(this._checkPopupWindowClosedInterval);
    this._checkPopupWindowClosedInterval = setInterval(() => {
      try {
        if (this._popupWindow && this._popupWindow.closed) {
          this._popupWindow = null;
        }
      } catch (e) {}

      if (!this._popupWindow) {
        clearInterval(this._checkPopupWindowClosedInterval);
      }
    }, 500);

  }

  setURL(url) {
    this._popupWindow.location = url;
  }

  close() {
    if (this._popupWindow) {
      this._popupWindow.close();
      this._popupWindow = null;
    }
  }

  isOpen() {
    return !!this._popupWindow;
  }

  isClosed() {
    return !this._popupWindow;
  }

  startPageRefocusInterval(options) {

    // Run a callback function when the focus goes back on the main window (regardless if _popupWindow was closed)

    const {
      stopIntervalClause,
      onRefocus
    } = options;

    let hasFocus = document.hasFocus();

    this.stopPageRefocusInterval()
    this._checkPageRefocusInterval = setInterval(async () => {

      if (!hasFocus && document.hasFocus()) {

        // We've selected something else and then switched back to this page/window.

        onRefocus();
      }

      if (stopIntervalClause()) {

        // Clear the interval and exit when the provided function returns true.

        this.stopPageRefocusInterval()
      }

      // This line makes sure the focus has been lost in the first place,
      // in case hasFocus has been true from the beginning.

      hasFocus = document.hasFocus();
    }, 250);

  }

  stopPageRefocusInterval() {
    clearInterval(this._checkPageRefocusInterval);
  }

}

export default PopupWindow;
