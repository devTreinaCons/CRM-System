// Reusable Modal Component
export function openModal({ title, content, footer, size = 'md' }) {
    closeModal();

    const maxWidths = { sm: '400px', md: '560px', lg: '720px', xl: '900px' };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = maxWidths[size] || maxWidths.md;

    modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${title}</h2>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
    ${footer ? `<div class="modal-footer" id="modal-footer"></div>` : ''}
  `;

    overlay.appendChild(modal);
    document.getElementById('modal-root').appendChild(overlay);

    const bodyEl = modal.querySelector('#modal-body');
    if (typeof content === 'string') {
        bodyEl.innerHTML = content;
    } else if (content instanceof HTMLElement) {
        bodyEl.appendChild(content);
    }

    if (footer) {
        const footerEl = modal.querySelector('#modal-footer');
        if (typeof footer === 'string') {
            footerEl.innerHTML = footer;
        } else if (footer instanceof HTMLElement) {
            footerEl.appendChild(footer);
        }
    }

    modal.querySelector('#modal-close-btn').addEventListener('click', closeModal);

    // ESC to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    return { overlay, modal, body: bodyEl };
}

export function closeModal() {
    const existing = document.getElementById('active-modal');
    if (existing) {
        existing.style.opacity = '0';
        setTimeout(() => existing.remove(), 200);
    }
}
