export class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentPage = null;
        window.addEventListener('hashchange', () => this.resolve());
    }

    resolve() {
        const hash = window.location.hash || '#/';
        const [rawPath, queryString] = hash.slice(1).split('?');
        const path = rawPath || '/';

        // Parse query params
        const qParams = {};
        if (queryString) {
            queryString.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                if (key) {
                    qParams[decodeURIComponent(key)] = decodeURIComponent(value || '');
                }
            });
        }

        // Match route
        let matchedRoute = null;
        let params = { ...qParams };

        for (const route of this.routes) {
            const routeParts = (route.path === '/' ? [] : route.path.split('/').filter(Boolean));
            const pathParts = (path === '/' ? [] : path.split('/').filter(Boolean));

            if (routeParts.length !== pathParts.length) continue;

            let match = true;
            const routeParams = {};

            for (let i = 0; i < routeParts.length; i++) {
                if (routeParts[i].startsWith(':')) {
                    routeParams[routeParts[i].slice(1)] = pathParts[i];
                } else if (routeParts[i] !== pathParts[i]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                matchedRoute = route;
                params = { ...params, ...routeParams };
                break;
            }
        }

        if (!matchedRoute) {
            matchedRoute = this.routes.find(r => r.path === '/') || this.routes[0];
        }

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.page === matchedRoute.name) {
                el.classList.add('active');
            }
        });

        // Render page
        const container = document.getElementById('page-content');
        if (container && matchedRoute.render) {
            this.currentPage = matchedRoute;
            matchedRoute.render(container, params);
        }
    }

    navigate(path) {
        window.location.hash = path;
    }
}
