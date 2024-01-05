import Dialog from './Dialog';

class LoadingDialog extends Dialog {
  constructor({}) {
    super({
      width: 150,
      height: 150,
      showHeader: false,
      showClose: false
    })
  }

  render(data) {
    super.render(data);

    this._container.style.width = '100%';
    this._container.style.height = '100%';
    this._container.style.display = 'flex';
    this._container.style.justifyContent = 'center';
    this._container.style.alignItems = 'center';
    this._container.style.flexDirection = 'column';

    let loading = document.createElement('span');
    loading.style.marginBottom = '10px';
    this._container.append(loading);

    let spinner = document.createElement('div');
    spinner.style.display = 'inline-block';
    spinner.style.border = '4px solid rgba(0, 0, 0, 0.1)';
    spinner.style.borderRadius = '50%';
    spinner.style.borderTop = '4px solid #3498db';
    spinner.style.width = '30px';
    spinner.style.height = '30px';

    spinner.animate({
      transform: ['rotate(0deg)', 'rotate(360deg)']
    }, {
      duration: 1000,
      iterations: Infinity,
      timing: 'linear'
    });

    this._container.append(spinner);
  }
}

export default LoadingDialog;
