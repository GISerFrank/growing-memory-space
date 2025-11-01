// 简单的平移缩放实现 - 替代 Panzoom (最终 V8 - 统一坐标系)
class SimplePanZoom {
    constructor(element, options = {}) {
        this.element = element;
        this.container = element.parentElement;

        this.options = options;

        // 状态
        this.scale = options.startScale || 1;
        this.x = options.startX || 0;
        this.y = options.startY || 0;

        this.maxScale = options.maxScale || 5;

        // --- V6/V8 坐标系修复: 获取 padding AND border ---
        const computedStyle = getComputedStyle(this.container);
        this.paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        this.paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        this.borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        this.borderTop = parseFloat(computedStyle.borderTopWidth) || 0;

        // 拖动状态
        this.isDragging = false;
        this.startX = 0; // 拖动起始点 (基于内容框)
        this.startY = 0; // 拖动起始点 (基于内容框)

        // 绑定事件
        this.bindEvents();

        // --- 初始化时应用 V4 逻辑 ---
        const dynamicMinScale = this._getMinCoverScale();
        if (this.scale < dynamicMinScale) {
            this.scale = dynamicMinScale;
        }
        const clamped = this._clampPan(this.x, this.y);
        this.x = clamped.x;
        this.y = clamped.y;

        this.applyTransform();
    }

    /**
     * [V4 修复] 辅助函数：获取能 "cover" 视口的最小缩放
     * 使用 clientWidth/Height (不含 padding) 和 epsilon 缓冲
     */
// [修改后的代码 - 实现无限画布]
    _getMinCoverScale() {
        // 我们不再计算 "cover" 缩放。
        // 我们只返回用户在选项中定义的 minScale，或者一个合理的默认值 (例如 0.1)。
        const userMinScale = this.options.minScale || 0.1;
        return userMinScale;
    }

    /**
     * [V4 修复] 核心辅助函数：限制平移边界
     * 使用 clientWidth/Height (不含 padding)
     */
    _clampPan(x, y) {
        // 不再计算边界，直接返回用户想要的 x 和 y。
        // 这允许在所有缩放级别上无限拖动。
        return { x, y };
    }

    bindEvents() {
        this.element.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        // [!] V2 修复: this.zoomWithWheel 必须是已绑定的
        this.container.addEventListener('wheel', this.zoomWithWheel, { passive: false });
        this.element.addEventListener('touchstart', this.onTouchStart.bind(this));
        document.addEventListener('touchmove', this.onTouchMove.bind(this));
        document.addEventListener('touchend', this.onTouchEnd.bind(this));
    }

    /**
     * [V8 修复] 辅助函数: 获取 "内容框" 坐标系中的鼠标/触摸位置
     */
    _getCoords(e) {
        const rect = this.container.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const mouseX = clientX - rect.left - this.borderLeft - this.paddingLeft;
        const mouseY = clientY - rect.top - this.borderTop - this.paddingTop;

        return { x: mouseX, y: mouseY };
    }

    onMouseDown(e) {
        if (e.target.closest('.memory-element')) return;

        // --- V8 修复: 使用 _getCoords ---
        const coords = this._getCoords(e);

        this.isDragging = true;
        // 比较 内容框坐标 vs 内容框坐标
        this.startX = coords.x - this.x;
        this.startY = coords.y - this.y;
        // -----------------------------

        this.element.style.cursor = 'grabbing';
        this.element.dispatchEvent(new CustomEvent('panzoom:panstart'));
        e.preventDefault();
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        // --- V8 修复: 使用 _getCoords ---
        const coords = this._getCoords(e);

        // 计算新的 x/y (基于内容框坐标)
        const newX = coords.x - this.startX;
        const newY = coords.y - this.startY;
        // -----------------------------

        const clamped = this._clampPan(newX, newY); // 拖动时实时限制
        this.x = clamped.x;
        this.y = clamped.y;

        this.applyTransform();
    }

    onMouseUp() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.element.style.cursor = 'grab';
        this.element.dispatchEvent(new CustomEvent('panzoom:panend'));
    }

    onTouchStart(e) {
        if (e.target.closest('.memory-element')) return;
        if (e.touches.length === 1) {

            // --- V8 修复: 使用 _getCoords ---
            const coords = this._getCoords(e);

            this.isDragging = true;
            this.startX = coords.x - this.x;
            this.startY = coords.y - this.y;
            // -----------------------------

            this.element.dispatchEvent(new CustomEvent('panzoom:panstart'));
        }
    }

    onTouchMove(e) {
        if (!this.isDragging || e.touches.length !== 1) return;

        // --- V8 修复: 使用 _getCoords ---
        const coords = this._getCoords(e);

        const newX = coords.x - this.startX;
        const newY = coords.y - this.startY;
        // -----------------------------

        const clamped = this._clampPan(newX, newY);
        this.x = clamped.x;
        this.y = clamped.y;

        this.applyTransform();
        e.preventDefault();
    }

    onTouchEnd() {
        if (this.isDragging) {
            this.isDragging = false;
            this.element.dispatchEvent(new CustomEvent('panzoom:panend'));
        }
    }

    onWheel(e) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const oldScale = this.scale;

        const dynamicMinScale = this._getMinCoverScale();
        const newScale = Math.max(dynamicMinScale, Math.min(this.maxScale, this.scale * delta));

        if (newScale === oldScale) return;

        // --- V8 修复: 使用 _getCoords (V6 逻辑) ---
        const coords = this._getCoords(e);
        const mouseX = coords.x;
        const mouseY = coords.y;
        // ----------------------------------------

        const scaleDiff = newScale / oldScale;

        let newX = mouseX - (mouseX - this.x) * scaleDiff;
        let newY = mouseY - (mouseY - this.y) * scaleDiff;

        this.scale = newScale;

        const clamped = this._clampPan(newX, newY);
        this.x = clamped.x;
        this.y = clamped.y;

        this.applyTransform();

        this.element.dispatchEvent(new CustomEvent('panzoom:zoom', {
            detail: { scale: this.scale, x: this.x, y: this.y }
        }));
    }

    applyTransform(animate = false) {
        if (animate) {
            this.element.style.transition = 'transform 0.3s ease-out';
        } else {
            this.element.style.transition = 'none';
        }

        this.element.style.transform = `matrix(${this.scale}, 0, 0, ${this.scale}, ${this.x}, ${this.y})`;
        this.element.style.transformOrigin = '0 0';

        if (animate) {
            setTimeout(() => {
                this.element.style.transition = 'none';
            }, 300);
        }
    }

    zoom(targetScale, options = {}) {
        const dynamicMinScale = this._getMinCoverScale();
        this.scale = Math.max(dynamicMinScale, Math.min(this.maxScale, targetScale));

        const clamped = this._clampPan(this.x, this.y);
        this.x = clamped.x;
        this.y = clamped.y;

        this.applyTransform(options.animate);

        this.element.dispatchEvent(new CustomEvent('panzoom:zoom', {
            detail: { scale: this.scale, x: this.x, y: this.y }
        }));

        return { scale: this.scale, x: this.x, y: this.y };
    }

    pan(targetX, targetY, options = {}) {
        const clamped = this._clampPan(targetX, targetY);
        this.x = clamped.x;
        this.y = clamped.y;

        this.applyTransform(options.animate);
        return { scale: this.scale, x: this.x, y: this.y };
    }

    getScale() {
        return this.scale;
    }

    getPan() {
        return { x: this.x, y: this.y };
    }

    // --- V2 修复: 转换为箭头函数以绑定 'this' ---
    zoomWithWheel = (e) => {
        this.onWheel(e);
    }

    setOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        if (newOptions.maxScale !== undefined) this.maxScale = newOptions.maxScale;
    }

    reset(options = {}) {
        const dynamicMinScale = this._getMinCoverScale();
        this.scale = Math.max(dynamicMinScale, this.options.startScale || 1);

        const targetX = this.options.startX || 0;
        const targetY = this.options.startY || 0;

        const clamped = this._clampPan(targetX, targetY);
        this.x = clamped.x;
        this.y = clamped.y;

        this.applyTransform(options.animate);

        this.element.dispatchEvent(new CustomEvent('panzoom:zoom', {
            detail: { scale: this.scale, x: this.x, y: this.y }
        }));
    }

    destroy() {
        this.element.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        // [!] V2 修复: 移除正确的监听器
        this.container.removeEventListener('wheel', this.zoomWithWheel);
        this.element.removeEventListener('touchstart', this.onTouchStart);
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);
    }
}

// 兼容 Panzoom 的接口
window.Panzoom = function(element, options) {
    return new SimplePanZoom(element, options);
};