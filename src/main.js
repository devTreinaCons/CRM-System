import './styles/index.css';
import { Router } from './router.js';
import { renderContacts } from './pages/contacts.js';
import { renderFunnels } from './pages/funnels.js';
import { renderTasks } from './pages/tasks.js';
import { renderAnalytics } from './pages/analytics.js';
import { renderProducts } from './pages/products.js';
import { renderCompanies } from './pages/companies.js';
import { renderLogin } from './pages/login.js';
import { supabase } from './supabase.js';


const router = new Router([
    {
        path: '/',
        name: 'analytics',
        render: (container) => renderAnalytics(container)
    },
    {
        path: '/contacts',
        name: 'contacts',
        render: (container, params) => renderContacts(container, params)
    },
    {
        path: '/contacts/:id',
        name: 'contacts',
        render: (container, params) => renderContacts(container, params)
    },
    {
        path: '/companies',
        name: 'companies',
        render: (container, params) => renderCompanies(container, params)
    },
    {
        path: '/companies/:id',
        name: 'companies',
        render: (container, params) => renderCompanies(container, params)
    },
    {
        path: '/funnels',
        name: 'funnels',
        render: (container) => renderFunnels(container)
    },
    {
        path: '/tasks',
        name: 'tasks',
        render: (container) => renderTasks(container)
    },
    {
        path: '/analytics',
        name: 'analytics',
        render: (container) => renderAnalytics(container)
    },
    {
        path: '/products',
        name: 'products',
        render: (container) => renderProducts(container)
    },
    {
        path: '/login',
        name: 'login',
        render: (container) => renderLogin(container)
    }
]);

// Auth State Management
async function initApp() {
    const { data: { session } } = await supabase.auth.getSession();

    // Subscribe to auth changes
    supabase.auth.onAuthStateChange((event, session) => {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');

        if (session) {
            if (sidebar) sidebar.style.display = 'flex';
            if (mainContent) mainContent.style.marginLeft = 'var(--sidebar-width)';

            // Update user info in sidebar
            const userAvatar = document.querySelector('.user-avatar');
            const userName = document.querySelector('.user-name');
            if (userAvatar) userAvatar.textContent = session.user.email.substring(0, 2).toUpperCase();
            if (userName) userName.textContent = session.user.email.split('@')[0];

            if (window.location.hash === '#/login' || window.location.hash === '#/') {
                window.location.hash = '#/analytics';
            }
        } else {
            if (sidebar) sidebar.style.display = 'none';
            if (mainContent) mainContent.style.marginLeft = '0';
            window.location.hash = '#/login';
        }
    });

    // Initial check
    if (!session && window.location.hash !== '#/login') {
        window.location.hash = '#/login';
    }

    router.resolve();
}

initApp();

