import { supabase } from '../supabase.js';
import { showToast } from '../components/toast.js';

export function renderLogin(container) {
  // Clear any existing content and sidebar (if needed)
  // But usually the router handles the container.

  // Hide sidebar during login
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = 'none';
  const mainContent = document.getElementById('main-content');
  if (mainContent) mainContent.style.marginLeft = '0';

  container.innerHTML = `
    <div class="login-container animate-in">
      <div class="login-card">
        <div class="login-header">
          <img src="/logo.png" alt="TreinaCons Logo" style="display: block; margin: 0 auto 24px; max-height: 80px; max-width: 100%;">
          <h1>Bem-vindo ao CRM</h1>
        </div>
        
        <form id="login-form" class="login-form">
          <div class="form-group">
            <label>E-mail</label>
            <div class="input-with-icon">
              <span class="material-symbols-outlined input-icon">mail</span>
              <input type="email" id="login-email" required placeholder="seu@email.com" class="form-input">
            </div>
          </div>
          
          <div class="form-group">
            <label>Senha</label>
            <div class="input-with-icon">
              <span class="material-symbols-outlined input-icon">lock</span>
              <input type="password" id="login-password" required placeholder="••••••••" class="form-input">
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary btn-block" id="btn-login" style="margin-top: 24px; justify-content: center; height: 44px;">
            Acessar Sistema
          </button>
        </form>
        
        <div class="login-footer">
          <p>Esqueceu sua senha? <a href="#" class="link-styled">Contate o administrador</a></p>
        </div>
      </div>
    </div>
  `;

  // Add styles dynamically for login page
  if (!document.getElementById('login-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'login-styles';
    styleEl.textContent = `
      .login-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 80vh;
        padding: 20px;
      }
      .login-card {
        background: var(--bg-card);
        padding: 40px;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        width: 100%;
        max-width: 400px;
        border: 1px solid var(--border-color);
      }
      .login-header {
        text-align: center;
        margin-bottom: 32px;
      }
      .login-header h1 {
        font-size: var(--font-size-xl);
        font-weight: 800;
        margin-bottom: 4px;
      }
      .login-header p {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
      .login-form .form-group {
        margin-bottom: 16px;
      }
      .login-form label {
        display: block;
        margin-bottom: 6px;
        font-weight: 600;
        font-size: var(--font-size-sm);
      }
      .input-with-icon {
        position: relative;
      }
      .input-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        font-size: 20px !important;
      }
      .form-input {
        width: 100%;
        padding: 10px 12px 10px 40px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        font-size: var(--font-size-base);
        transition: all var(--transition-fast);
      }
      .form-input:focus {
        border-color: var(--accent-primary);
        outline: none;
        box-shadow: 0 0 0 3px var(--accent-primary-glow);
      }
      .btn-block {
        width: 100%;
      }
      .login-footer {
        margin-top: 24px;
        text-align: center;
        font-size: var(--font-size-xs);
        color: var(--text-muted);
      }
    `;
    document.head.appendChild(styleEl);
  }

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');

    try {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner btn-spinner"></div> Autenticando...';

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      showToast('Login realizado com sucesso!', 'success');

      // Update sidebar state before navigating
      if (sidebar) sidebar.style.display = 'flex';
      if (mainContent) mainContent.style.marginLeft = 'var(--sidebar-width)';

      window.location.hash = '#/';
    } catch (error) {
      console.error('Login error:', error);
      showToast('Erro ao entrar: ' + error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = 'Acessar Sistema';
    }
  });
}
