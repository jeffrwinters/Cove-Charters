class AdminSidePanel {
  constructor(options = {}) {
    this.options = {
      panelId: 'adminSidePanel',
      overlayId: 'adminSidePanelOverlay',
      onClose: null,
      ...options
    };
    this.previousFocus = null;
    this.ensureDom();
    this.bindEvents();
  }

  ensureDom() {
    this.overlay = document.getElementById(this.options.overlayId);
    this.panel = document.getElementById(this.options.panelId);

    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.id = this.options.overlayId;
      this.overlay.className = 'admin-side-panel-overlay';
      document.body.appendChild(this.overlay);
    }

    if (!this.panel) {
      this.panel = document.createElement('aside');
      this.panel.id = this.options.panelId;
      this.panel.className = 'admin-side-panel';
      this.panel.setAttribute('aria-hidden', 'true');
      this.panel.innerHTML = this.template();
      document.body.appendChild(this.panel);
    }

    this.eyebrow = this.panel.querySelector('[data-side-panel-eyebrow]');
    this.title = this.panel.querySelector('[data-side-panel-title]');
    this.subtitle = this.panel.querySelector('[data-side-panel-subtitle]');
    this.body = this.panel.querySelector('[data-side-panel-body]');
    this.footer = this.panel.querySelector('[data-side-panel-footer]');
    this.closeButton = this.panel.querySelector('[data-side-panel-close]');
  }

  template() {
    return `
      <header class="admin-side-panel__header">
        <div class="admin-side-panel__topline">
          <div class="admin-side-panel__eyebrow" data-side-panel-eyebrow>Details</div>
          <button class="admin-side-panel__close" type="button" aria-label="Close panel" data-side-panel-close>x</button>
        </div>
        <h2 class="admin-side-panel__title" data-side-panel-title>Record</h2>
        <p class="admin-side-panel__subtitle" data-side-panel-subtitle></p>
      </header>
      <div class="admin-side-panel__body" data-side-panel-body></div>
      <footer class="admin-side-panel__footer" data-side-panel-footer></footer>
    `;
  }

  bindEvents() {
    this.overlay.addEventListener('click', () => this.close());
    this.closeButton.addEventListener('click', () => this.close());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  open({ eyebrow = 'Details', title = 'Record', subtitle = '', body = '', footer = '' } = {}) {
    this.previousFocus = document.activeElement;
    this.eyebrow.textContent = eyebrow;
    this.title.textContent = title;
    this.subtitle.textContent = subtitle;
    this.body.innerHTML = body;
    this.footer.innerHTML = footer;
    this.overlay.classList.add('is-open');
    this.panel.classList.add('is-open');
    this.panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    this.closeButton.focus({ preventScroll: true });
  }

  close() {
    this.overlay.classList.remove('is-open');
    this.panel.classList.remove('is-open');
    this.panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (typeof this.options.onClose === 'function') this.options.onClose();
    if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
      this.previousFocus.focus({ preventScroll: true });
    }
  }

  isOpen() {
    return this.panel.classList.contains('is-open');
  }

  setBody(html) {
    this.body.innerHTML = html;
  }

  setFooter(html) {
    this.footer.innerHTML = html;
  }

  static field(label, value) {
    return `<div class="admin-side-panel-field"><label>${AdminSidePanel.escape(label)}</label><span>${AdminSidePanel.escape(value || '-')}</span></div>`;
  }

  static pill(value) {
    return `<span class="admin-side-panel-pill">${AdminSidePanel.escape(value || '-')}</span>`;
  }

  static escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }
}

window.AdminSidePanel = AdminSidePanel;
