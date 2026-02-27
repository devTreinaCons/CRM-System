// Toast notification system
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span>', error: '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">close</span>', warning: '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">warning</span>', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
