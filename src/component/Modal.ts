/**
 * Modal 组件 - 可复用的确认框（单例模式）
 * 标题和内容可变，关闭/取消按钮固定关闭modal，确认按钮接收自定义函数
 */

export class Modal {
  private static instance: Modal | null = null;
  private overlay: HTMLDivElement | null = null;
  private messageBox: HTMLDivElement | null = null;
  private titleEl: HTMLSpanElement | null = null;
  private messageEl: HTMLSpanElement | null = null;
  private onConfirmCallback: (() => void) | null = null;

  private constructor() {
    this.initDOM();
    this.bindEvents();
  }

  /**
   * 获取 Modal 单例实例
   */
  static getInstance(): Modal {
    if (!Modal.instance) {
      Modal.instance = new Modal();
    }
    return Modal.instance;
  }

  /**
   * 初始化 DOM 结构
   */
  private initDOM(): void {
    // 创建遮罩层
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';

    // 创建消息框容器
    this.messageBox = document.createElement('div');
    this.messageBox.className = 'el-message-box';

    // 创建头部
    const header = document.createElement('div');
    header.className = 'el-message-box__header';

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'el-message-box__title';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'el-message-box__closebtn';
    closeBtn.textContent = '×';
    closeBtn.id = 'modal-close-btn';

    header.appendChild(this.titleEl);
    header.appendChild(closeBtn);

    // 创建内容
    const content = document.createElement('div');
    content.className = 'el-message-box__content';

    const status = document.createElement('span');
    status.className = 'el-message-box__status el-message-box-icon--warning';
    status.textContent = '!';

    this.messageEl = document.createElement('span');

    content.appendChild(status);
    content.appendChild(this.messageEl);

    // 创建按钮组
    const btns = document.createElement('div');
    btns.className = 'el-message-box__btns';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'el-button';
    cancelBtn.textContent = '取消';
    cancelBtn.id = 'modal-cancel-btn';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'el-button el-button--primary';
    confirmBtn.textContent = '确定';
    confirmBtn.id = 'modal-confirm-btn';

    btns.appendChild(cancelBtn);
    btns.appendChild(confirmBtn);

    // 组装
    this.messageBox.appendChild(header);
    this.messageBox.appendChild(content);
    this.messageBox.appendChild(btns);
    this.overlay.appendChild(this.messageBox);
    document.body.appendChild(this.overlay);
  }

  /**
   * 绑定事件（只执行一次）
   */
  private bindEvents(): void {
    // 关闭按钮
    document.getElementById('modal-close-btn')?.addEventListener('click', this.handleCloseClick);
    // 取消按钮
    document.getElementById('modal-cancel-btn')?.addEventListener('click', this.handleCloseClick);
    // 确认按钮
    document.getElementById('modal-confirm-btn')?.addEventListener('click', this.handleConfirmClick);
    // 点击遮罩层
    this.overlay?.addEventListener('click', this.handleOverlayClick);
    // ESC 键
    document.addEventListener('keydown', this.handleEscKeyPress);
  }

  // ===== 事件处理方法 =====

  private readonly handleCloseClick = (): void => {
    this.hide();
  };

  private readonly handleConfirmClick = (): void => {
    if (this.onConfirmCallback) {
      this.onConfirmCallback();
    }
    this.hide();
  };

  private readonly handleOverlayClick = (e: MouseEvent): void => {
    if (e.target === this.overlay) {
      this.hide();
    }
  };

  private readonly handleEscKeyPress = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !this.overlay?.classList.contains('hidden')) {
      this.hide();
    }
  };

  // ===== 公开方法 =====

  /**
   * 显示确认框
   * @param title - 确认框标题
   * @param message - 确认框消息内容
   * @param onConfirm - 确认后执行的回调函数
   */
  showConfirm(title: string, message: string, onConfirm: () => void): void {
    this.onConfirmCallback = onConfirm;
    this.titleEl!.textContent = title;
    this.messageEl!.textContent = message;
    this.overlay!.classList.remove('hidden');
  }

  /**
   * 隐藏确认框
   */
  hide(): void {
    this.overlay?.classList.add('hidden');
    this.onConfirmCallback = null;
  }
}

/**
 * 便捷函数 - 使用单例显示确认框
 * @param title - 确认框标题
 * @param message - 确认框消息内容
 * @param onConfirm - 确认后执行的回调函数
 */
export function showConfirm(title: string, message: string, onConfirm: () => void): void {
  Modal.getInstance().showConfirm(title, message, onConfirm);
}
