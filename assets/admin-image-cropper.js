class AdminImageCropper {
  constructor(root, options = {}) {
    this.root = root;
    this.options = {
      imageUrl: '',
      focalX: 50,
      focalY: 30,
      zoom: 1,
      frame: 'circle',
      hint: 'Adjust focus and zoom until the image looks right in the preview.',
      onChange: null,
      ...options
    };
    this.render();
    this.bind();
    this.sync();
  }

  render() {
    const frameClass = this.options.frame === 'wide' ? 'admin-cropper-frame wide' : this.options.frame === 'rounded-square' ? 'admin-cropper-frame rounded-square' : 'admin-cropper-frame';
    this.root.classList.add('admin-cropper');
    this.root.innerHTML = `
      <div class="admin-cropper-stage">
        <div class="${frameClass}" data-crop-frame>
          <img data-crop-image alt="Crop preview">
        </div>
      </div>
      <div class="admin-cropper-controls">
        <label>Horizontal focus <input data-crop-x type="range" min="0" max="100" step="1"></label>
        <label>Vertical focus <input data-crop-y type="range" min="0" max="100" step="1"></label>
        <label>Zoom <input data-crop-zoom type="range" min="1" max="2" step="0.01"></label>
      </div>
      <p class="admin-cropper-hint">${this.escape(this.options.hint)}</p>
    `;
    this.frame = this.root.querySelector('[data-crop-frame]');
    this.image = this.root.querySelector('[data-crop-image]');
    this.xInput = this.root.querySelector('[data-crop-x]');
    this.yInput = this.root.querySelector('[data-crop-y]');
    this.zoomInput = this.root.querySelector('[data-crop-zoom]');
  }

  bind() {
    [this.xInput, this.yInput, this.zoomInput].forEach(input => {
      input.addEventListener('input', () => this.syncFromInputs());
    });
  }

  sync() {
    this.image.src = this.options.imageUrl || '';
    this.xInput.value = this.options.focalX;
    this.yInput.value = this.options.focalY;
    this.zoomInput.value = this.options.zoom;
    this.apply();
  }

  syncFromInputs() {
    this.options.focalX = Number(this.xInput.value);
    this.options.focalY = Number(this.yInput.value);
    this.options.zoom = Number(this.zoomInput.value);
    this.apply();
    if (typeof this.options.onChange === 'function') this.options.onChange(this.value());
  }

  apply() {
    this.frame.style.setProperty('--crop-x', `${this.options.focalX}%`);
    this.frame.style.setProperty('--crop-y', `${this.options.focalY}%`);
    this.frame.style.setProperty('--crop-zoom', this.options.zoom);
  }

  value() {
    return {
      focalX: this.options.focalX,
      focalY: this.options.focalY,
      zoom: this.options.zoom
    };
  }

  setImage(imageUrl) {
    this.options.imageUrl = imageUrl || '';
    this.image.src = this.options.imageUrl;
  }

  setValue(value = {}) {
    this.options.focalX = Number(value.focalX ?? this.options.focalX ?? 50);
    this.options.focalY = Number(value.focalY ?? this.options.focalY ?? 50);
    this.options.zoom = Number(value.zoom ?? this.options.zoom ?? 1);
    this.sync();
  }

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
}

window.AdminImageCropper = AdminImageCropper;
