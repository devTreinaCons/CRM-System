import { supabase } from '../supabase.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { escapeHTML } from '../utils/sanitize.js';

export async function renderCompanies(container, params) {
  const companyId = params?.id;

  if (companyId) {
    await renderCompanyDetail(container, companyId);
  } else {
    await renderCompaniesList(container);
  }
}

async function renderCompaniesList(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h1 class="page-title">Empresas</h1>
        <p class="page-subtitle">Gerencie as organizações parceiras e clientes</p>
      </div>
      <button class="btn btn-primary" id="btn-add-company">
        <span class="material-symbols-outlined">add</span> Nova Empresa
      </button>
    </div>

    <div class="card search-filter-card">
      <div class="search-box">
        <span class="material-symbols-outlined">search</span>
        <input type="text" id="search-companies" placeholder="Buscar empresas por nome ou setor...">
      </div>
    </div>

    <div id="companies-grid" class="companies-grid">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  const grid = document.getElementById('companies-grid');
  const searchInput = document.getElementById('search-companies');

  async function loadCompanies(query = '') {
    grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    let dbQuery = supabase
      .from('companies')
      .select('*, contact_companies(count)')
      .order('name');

    if (query) {
      dbQuery = dbQuery.ilike('name', `%${query}%`);
    }

    const { data: companies, error } = await dbQuery;

    if (error) {
      grid.innerHTML = '<div class="empty-state">Erro ao carregar empresas</div>';
      return;
    }

    if (companies.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <div class="empty-state-icon"><span class="material-symbols-outlined">corporate_fare</span></div>
          <div class="empty-state-title">Nenhuma empresa encontrada</div>
          <p class="empty-state-text">Clique em "Nova Empresa" para começar.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = companies.map(company => `
      <div class="card company-card" onclick="window.location.hash = '#/companies/${company.id}'">
        <div class="company-card-header">
          <div class="avatar company-avatar" style="background:${escapeHTML(company.avatar_color) || '#64748b'}">
            <span class="material-symbols-outlined">${escapeHTML(company.logo_icon) || 'corporate_fare'}</span>
          </div>
          <div class="company-card-info">
            <h3 class="company-card-name">${escapeHTML(company.name)}</h3>
            <span class="company-card-industry">${escapeHTML(company.industry) || 'Setor não informado'}</span>
          </div>
        </div>
        <div class="company-card-stats">
          <div class="company-stat">
            <span class="stat-value">${company.contact_companies[0].count}</span>
            <span class="stat-label">Contatos</span>
          </div>
          <div class="company-stat">
            <span class="stat-value">--</span>
            <span class="stat-label">Deals</span>
          </div>
        </div>
        <div class="company-card-footer">
          <span class="material-symbols-outlined" style="font-size:16px">language</span>
          <span class="company-website">${escapeHTML(company.website) || 'Sem site'}</span>
        </div>
      </div>
    `).join('');
  }

  searchInput.addEventListener('input', (e) => {
    loadCompanies(e.target.value);
  });

  document.getElementById('btn-add-company').addEventListener('click', () => {
    showCompanyForm(null, () => loadCompanies());
  });

  loadCompanies();
}

async function renderCompanyDetail(container, companyId) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const [
    { data: company },
    { data: contactCompanies },
    { data: purchases },
    { data: opportunities },
    { data: tasks },
    { data: notes },
    { data: profiles }
  ] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase.from('contact_companies').select('*, contacts(*)').eq('company_id', companyId),
    supabase.from('purchases').select('*, products(name, icon), purchase_participants(contact_id)').eq('company_id', companyId).order('purchase_date', { ascending: false }),
    supabase.from('contact_funnel').select('*, contacts(name), funnels(name, products(name, icon, color)), funnel_stages:current_stage_id(name, color, position)').eq('company_id', companyId).not('status', 'in', '("won","lost")'),
    supabase.from('tasks').select('*, profiles:assigned_to(name)').eq('company_id', companyId).order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('contact_notes').select('*, profiles:user_id(name)').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').order('name')
  ]);

  const employees = (contactCompanies || []).map(cc => ({ ...cc.contacts, position: cc.position || cc.contacts.position }));

  if (!company) {
    container.innerHTML = '<div class="empty-state">Empresa não encontrada</div>';
    return;
  }

  container.innerHTML = `
    <div class="animate-in">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash = '#/companies'">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="avatar avatar-lg" style="background:${escapeHTML(company.avatar_color) || '#64748b'}">
            <span class="material-symbols-outlined" style="font-size:32px">${escapeHTML(company.logo_icon) || 'corporate_fare'}</span>
          </div>
          <div class="page-title-group">
            <h1 class="page-title">${escapeHTML(company.name)}</h1>
            <p class="page-subtitle">${escapeHTML(company.industry) || 'Setor não informado'}</p>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btn-edit-company">
            <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle;">edit</span> Editar
          </button>
          <button class="btn btn-primary" id="btn-add-to-funnel">
            <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle;">sync</span> No Funil
          </button>
          <button class="btn btn-danger btn-sm" id="btn-delete-company">
            <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle;">delete</span>
          </button>
        </div>
      </div>

      <div class="contact-detail-grid">
        <div class="contact-sidebar">
          <div class="card" style="margin-bottom:24px">
            <h3 class="card-title" style="margin-bottom:16px"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:8px;color:var(--accent-primary)">sync</span> Oportunidades Ativas</h3>
            <div id="company-opportunities-list">
              ${!opportunities || opportunities.length === 0 ?
      '<div class="empty-state-simple">Nenhuma negociação em curso.</div>' :
      opportunities.map(opp => `
                  <div class="opportunity-item" onclick="window.location.hash = '#/funnels'" style="position:relative">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                      <span class="material-symbols-outlined" style="color:${escapeHTML(opp.funnels?.products?.color) || 'var(--accent-primary)'};background:var(--bg-input);padding:8px;border-radius:var(--radius-sm)">${escapeHTML(opp.funnels?.products?.icon) || 'inventory_2'}</span>
                      <div style="flex:1">
                        <div style="font-weight:700;font-size:var(--font-size-sm)">${escapeHTML(opp.funnels?.products?.name) || escapeHTML(opp.funnels?.name)}</div>
                        ${opp.contacts?.name ? `<div style="font-size:10px;color:var(--accent-primary);font-weight:600;margin-bottom:2px">${escapeHTML(opp.contacts.name)}</div>` : ''}
                        <div style="font-size:var(--font-size-xs);color:var(--text-muted)">Etapa: <span style="color:${escapeHTML(opp.funnel_stages?.color)};font-weight:600">${escapeHTML(opp.funnel_stages?.name)}</span></div>
                        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Desde: ${formatDate(opp.entered_at)}</div>
                      </div>
                      <div style="display:flex; gap:8px">
                        <span class="material-symbols-outlined" style="font-size:16px;color:var(--text-muted)">open_in_new</span>
                        <button class="btn btn-ghost btn-xs btn-remove-opp" data-opp-id="${opp.id}" title="Remover do Funil" onclick="event.stopPropagation()">
                          <span class="material-symbols-outlined" style="font-size:18px; color:var(--accent-danger)">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                `).join('')}
            </div>
          </div>

          <div class="card">
            <h4 class="card-title" style="margin-bottom:16px"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:8px;color:var(--accent-primary)">info</span> Informações</h4>
            <ul class="contact-info-list">
              <li class="contact-info-item">
                <span class="info-icon"><span class="material-symbols-outlined">language</span></span>
                ${company.website ? `<a href="${escapeHTML(company.website)}" target="_blank" class="link-styled">${escapeHTML(company.website)}</a>` : '<span style="color:var(--text-muted)">Sem site</span>'}
              </li>
              <li class="contact-info-item">
                <span class="info-icon"><span class="material-symbols-outlined">category</span></span>
                ${escapeHTML(company.industry) || '<span style="color:var(--text-muted)">Indústria não informada</span>'}
              </li>
              <li class="contact-info-item">
                <span class="info-icon"><span class="material-symbols-outlined">calendar_today</span></span>
                Desde ${formatDate(company.created_at)}
              </li>
            </ul>
          </div>
        </div>

        <div class="contact-main">
          <!-- Employees Section -->
          <div class="section-card">
            <div class="section-header">
              <h3 class="section-title"><span class="material-symbols-outlined">group</span> Contatos da Empresa</h3>
              <button class="btn btn-primary btn-xs" id="btn-add-employee">
                <span class="material-symbols-outlined" style="font-size:16px">add</span> Novo Contato
              </button>
            </div>
            
            <div class="card" style="padding:0; overflow:hidden">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Contato</th>
                    <th>Cargo</th>
                    <th>E-mail</th>
                    <th style="text-align:right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${employees.length === 0 ? '<tr><td colspan="4" class="table-empty-state">Nenhum contato vinculado à empresa.</td></tr>' :
      employees.map(emp => `
                      <tr onclick="window.location.hash = '#/contacts/${emp.id}'" style="cursor:pointer">
                        <td>
                          <div style="display:flex;align-items:center;gap:10px">
                            <div class="avatar avatar-xs" style="background:${escapeHTML(emp.avatar_color) || 'var(--accent-primary)'}">${getInitials(emp.name)}</div>
                            <span style="font-weight:600">${escapeHTML(emp.name)}</span>
                          </div>
                        </td>
                        <td><span style="font-size:var(--font-size-sm)">${escapeHTML(emp.position) || '—'}</span></td>
                        <td><span style="font-size:var(--font-size-sm);color:var(--text-muted)">${escapeHTML(emp.email) || '—'}</span></td>
                        <td style="text-align:right">
                          <button class="btn btn-ghost btn-xs">
                            <span class="material-symbols-outlined" style="font-size:18px">visibility</span>
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- B2B Purchases Section -->
          <div class="section-card" style="margin-top:24px">
            <div class="section-header">
              <h3 class="section-title"><span class="material-symbols-outlined">local_activity</span> Treinamentos e Contratos B2B</h3>
              <button class="btn btn-primary btn-xs" id="btn-add-b2b-purchase">
                <span class="material-symbols-outlined" style="font-size:16px">add</span> Nova Venda B2B
              </button>
            </div>

            <div class="card" style="padding:0; overflow:hidden">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Data</th>
                    <th style="text-align:right">Valor</th>
                    <th style="text-align:center">Alunos</th>
                    <th style="text-align:right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${!purchases || purchases.length === 0 ? '<tr><td colspan="5" class="table-empty-state">Nenhuma venda corporativa registrada.</td></tr>' :
      purchases.map(p => `
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px">
                            <div style="color:var(--accent-primary);background:var(--bg-input);padding:6px;border-radius:var(--radius-sm);display:flex">
                              <span class="material-symbols-outlined" style="font-size:18px">${escapeHTML(p.products?.icon) || 'inventory_2'}</span>
                            </div>
                            <span style="font-weight:600">${escapeHTML(p.products?.name) || 'Produto'}</span>
                          </div>
                        </td>
                        <td>${formatDate(p.purchase_date)}</td>
                        <td style="text-align:right;font-weight:700;color:var(--accent-success)">R$ ${formatCurrency(p.amount)}</td>
                        <td style="text-align:center">
                          <span class="badge ${p.purchase_participants?.length > 0 ? 'badge-primary' : 'badge-neutral'}">
                            ${p.purchase_participants?.length || 0} inscritos
                          </span>
                        </td>
                        <td style="text-align:right">
                          <div style="display:flex; justify-content:flex-end; gap:8px">
                            <button class="btn btn-ghost btn-xs btn-manage-participants" data-purchase-id="${p.id}" title="Gerenciar Participantes">
                              <span class="material-symbols-outlined" style="font-size:18px">person_add</span>
                            </button>
                            <button class="btn btn-ghost btn-xs btn-delete-b2b" data-purchase-id="${p.id}" title="Excluir Venda B2B">
                              <span class="material-symbols-outlined" style="font-size:18px; color:var(--accent-danger)">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tasks & Notes Panel -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-top:24px">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-main);"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:4px">check_circle</span> Atividades</h3>
                <button class="btn btn-primary btn-xs" id="btn-add-task-overview"><span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">add</span> Tarefa</button>
              </div>
              <div class="card" style="margin-bottom:20px; padding: 16px;">
                ${renderTasksTab(tasks || [], companyId, true)}
              </div>
            </div>

            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-main);"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:4px">notes</span> Anotações</h3>
                <button class="btn btn-secondary btn-xs" id="btn-add-note-overview"><span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">add</span> Nota</button>
              </div>
              <div class="card" style="padding: 16px;">
                ${renderNotesTab(notes || [], companyId, true)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-edit-company').addEventListener('click', () => {
    showCompanyForm(company, () => renderCompanyDetail(container, companyId));
  });

  const delBtn = document.getElementById('btn-delete-company');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      const content = document.createElement('div');
      content.innerHTML = `<p>Tem certeza que deseja excluir a empresa <strong>${company.name}</strong>?</p><p style="margin-top:8px;color:var(--accent-danger);font-size:var(--font-size-xs)">Isso excluirá também todos os contatos e dados vinculados e não pode ser desfeito.</p>`;

      const footer = document.createElement('div');
      footer.innerHTML = `
        <button class="btn btn-secondary" id="comp-cancel">Cancelar</button>
        <button class="btn btn-danger" id="comp-delete">Excluir Permanentemente</button>
      `;

      const { modal: confirmModal } = openModal({ title: 'Confirmar Exclusão', content, footer });

      confirmModal.querySelector('#comp-cancel').addEventListener('click', closeModal);
      confirmModal.querySelector('#comp-delete').addEventListener('click', async () => {
        try {
          confirmModal.querySelector('#comp-delete').disabled = true;
          confirmModal.querySelector('#comp-delete').innerHTML = '<div class="spinner btn-spinner"></div> Excluindo...';

          const { error } = await supabase.from('companies').delete().eq('id', companyId);
          if (error) throw error;

          closeModal();
          showToast('Empresa excluída com sucesso', 'success');
          window.location.hash = '#/companies';
        } catch (error) {
          console.error('Error deleting company:', error);
          showToast('Erro ao excluir empresa: ' + error.message, 'error');
          closeModal();
        }
      });
    });
  }

  document.getElementById('btn-add-employee').addEventListener('click', () => {
    window.location.hash = `#/contacts?new=true&company_id=${companyId}`;
  });

  document.getElementById('btn-add-b2b-purchase').addEventListener('click', () => {
    showB2BPurchaseForm(company, () => renderCompanyDetail(container, companyId));
  });

  document.getElementById('btn-add-to-funnel').addEventListener('click', () => {
    showAddToFunnelForm(company, () => renderCompanyDetail(container, companyId));
  });

  document.querySelectorAll('.btn-manage-participants').forEach(btn => {
    btn.addEventListener('click', () => {
      const purchaseId = btn.dataset.purchaseId;
      const purchase = purchases.find(p => p.id === purchaseId);
      showParticipantManager(purchase, employees, () => renderCompanyDetail(container, companyId));
    });
  });

  // Handle opportunity removal
  document.querySelectorAll('.btn-remove-opp').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const oppId = btn.dataset.oppId;
      if (!oppId) return;

      const content = document.createElement('div');
      content.innerHTML = `<p>Deseja remover esta oportunidade do funil?</p>`;

      const footer = document.createElement('div');
      footer.innerHTML = `
        <button class="btn btn-secondary" id="rm-opp-cancel">Cancelar</button>
        <button class="btn btn-danger" id="rm-opp-confirm">Remover</button>
      `;

      const { modal: rmModal } = openModal({ title: 'Remover do Funil', content, footer });

      rmModal.querySelector('#rm-opp-cancel').addEventListener('click', closeModal);
      rmModal.querySelector('#rm-opp-confirm').addEventListener('click', async () => {
        const { error } = await supabase.from('contact_funnel').delete().eq('id', oppId);
        if (error) {
          showToast('Erro ao remover', 'error');
        } else {
          showToast('Removido com sucesso', 'success');
          closeModal();
          renderCompanyDetail(container, companyId);
        }
      });
    });
  });

  // Handle B2B sale removal
  document.querySelectorAll('.btn-delete-b2b').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const purchaseId = btn.dataset.purchaseId;
      if (!purchaseId) return;

      const content = document.createElement('div');
      content.innerHTML = `<p>Deseja excluir permanentemente este registro de venda corporativa?</p><p style="font-size:var(--font-size-xs);color:var(--accent-danger);margin-top:8px">Isso removerá também o vínculo de todos os participantes inscritos.</p>`;

      const footer = document.createElement('div');
      footer.innerHTML = `
        <button class="btn btn-secondary" id="rm-b2b-cancel">Cancelar</button>
        <button class="btn btn-danger" id="rm-b2b-confirm">Excluir</button>
      `;

      const { modal: rmModal } = openModal({ title: 'Excluir Venda B2B', content, footer });

      rmModal.querySelector('#rm-b2b-cancel').addEventListener('click', closeModal);
      rmModal.querySelector('#rm-b2b-confirm').addEventListener('click', async () => {
        const { error } = await supabase.from('purchases').delete().eq('id', purchaseId);
        if (error) {
          showToast('Erro ao excluir venda', 'error');
        } else {
          showToast('Venda excluída com sucesso', 'success');
          closeModal();
          renderCompanyDetail(container, companyId);
        }
      });
    });
  });

  // Task & Note Handlers
  setupTaskHandlers(companyId, container, profiles);
  setupNoteHandlers(companyId, container, profiles);

  const addTaskBtn = document.getElementById('btn-add-task-overview');
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => showTaskForm(companyId, profiles, () => renderCompanyDetail(container, companyId)));
  }

  const addNoteBtn = document.getElementById('btn-add-note-overview');
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', () => showNoteForm(companyId, () => renderCompanyDetail(container, companyId)));
  }
}

async function showB2BPurchaseForm(company, onSave) {
  const { data: products } = await supabase.from('products').select('*').eq('active', true).order('name');

  const content = document.createElement('div');
  content.innerHTML = `
    <form id="b2b-purchase-form" class="form-grid">
      <div class="form-group" style="grid-column: 1 / -1">
        <label>Produto / Treinamento</label>
        <select name="product_id" class="form-select" required>
          <option value="">Selecione o produto</option>
          ${(products || []).map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} - R$ ${p.price || '--'}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data da Compra</label>
        <input type="date" name="purchase_date" value="${new Date().toISOString().split('T')[0]}" required>
      </div>
      <div class="form-group">
        <label>Valor do Contrato (R$)</label>
        <input type="number" name="amount" step="0.01" required placeholder="0.00" id="b2b-amount">
      </div>
      <div class="form-group" style="grid-column: 1 / -1">
        <label>Notas / Observações</label>
        <textarea name="notes" rows="2" placeholder="Ex: Treinamento para equipe de vendas..."></textarea>
      </div>
      <div class="form-actions" style="grid-column: 1 / -1">
        <button type="button" class="btn btn-secondary" id="btn-cancel-b2b">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar Venda B2B</button>
      </div>
    </form>
  `;

  const { modal } = openModal({ title: 'Nova Venda Corporativa', content });

  const productSelect = modal.querySelector('select[name="product_id"]');
  productSelect.addEventListener('change', () => {
    const selected = productSelect.options[productSelect.selectedIndex];
    const price = selected.dataset.price;
    if (price && price !== 'undefined') {
      modal.querySelector('#b2b-amount').value = price;
    }
  });

  modal.querySelector('#btn-cancel-b2b').addEventListener('click', closeModal);

  modal.querySelector('#b2b-purchase-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const { error } = await supabase.from('purchases').insert([{
      ...data,
      company_id: company.id,
      status: 'completed'
    }]);

    if (error) {
      showToast('Erro ao registrar venda', 'error');
    } else {
      showToast('Venda registrada com sucesso', 'success');
      closeModal();
      if (onSave) onSave();
    }
  });
}

async function showParticipantManager(purchase, employees, onSave) {
  const { data: participants } = await supabase
    .from('purchase_participants')
    .select('contact_id')
    .eq('purchase_id', purchase.id);

  const participantIds = new Set((participants || []).map(p => p.contact_id));

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="margin-bottom:16px">
      <p style="font-size:var(--font-size-sm);color:var(--text-muted)">Selecione os colaboradores que participarão do treinamento: <strong>${purchase.products?.name}</strong></p>
    </div>
    <div class="participant-selector-list" style="max-height:300px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-md)">
      ${employees.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhum colaborador cadastrado</div>' :
      employees.map(emp => `
          <label style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border-color);cursor:pointer;transition:background 0.2s" class="participant-row">
            <input type="checkbox" class="participant-check" value="${emp.id}" ${participantIds.has(emp.id) ? 'checked' : ''} style="width:18px;height:18px">
            <div class="avatar avatar-xs" style="background:${emp.avatar_color}">${emp.name.charAt(0)}</div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:var(--font-size-sm)">${emp.name}</div>
              <div style="font-size:10px;color:var(--text-muted)">${emp.position || 'Colaborador'}</div>
            </div>
          </label>
        `).join('')}
    </div>
    <div class="form-actions" style="margin-top:20px">
      <button class="btn btn-secondary" id="btn-close-participants">Fechar</button>
      <button class="btn btn-primary" id="btn-save-participants">Salvar Participantes</button>
    </div>
  `;

  const { modal } = openModal({ title: 'Gerenciar Participantes', content, size: 'md' });

  modal.querySelector('#btn-close-participants').addEventListener('click', closeModal);
  modal.querySelector('#btn-save-participants').addEventListener('click', async () => {
    const selectedIds = Array.from(modal.querySelectorAll('.participant-check:checked')).map(cb => cb.value);

    // Simple approach: delete all and re-insert
    await supabase.from('purchase_participants').delete().eq('purchase_id', purchase.id);

    if (selectedIds.length > 0) {
      const { error } = await supabase.from('purchase_participants').insert(
        selectedIds.map(cid => ({
          purchase_id: purchase.id,
          contact_id: cid,
          status: 'confirmed'
        }))
      );
      if (error) {
        showToast('Erro ao salvar participantes', 'error');
        return;
      }
    }

    showToast('Lista de participantes atualizada', 'success');
    closeModal();
    if (onSave) onSave();
  });
}

async function showAddToFunnelForm(company, onSave) {
  const [
    { data: funnels },
    { data: stages }
  ] = await Promise.all([
    supabase.from('funnels').select('*, products(name, icon, color)').eq('active', true).order('created_at'),
    supabase.from('funnel_stages').select('*').order('position')
  ]);

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Funil / Produto</label>
      <select class="form-select" id="atf-funnel">
        ${(funnels || []).map(f => `<option value="${f.id}">${f.products?.name || f.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Etapa Inicial</label>
      <select class="form-select" id="atf-stage">
        <!-- Will be populated by JS -->
      </select>
    </div>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="btn btn-secondary" id="atf-cancel">Cancelar</button><button class="btn btn-primary" id="atf-save">Adicionar ao Funil</button>`;

  const { modal } = openModal({ title: `Iniciar Negociação com ${company.name}`, content, footer });

  const funnelSelect = modal.querySelector('#atf-funnel');
  const stageSelect = modal.querySelector('#atf-stage');

  const updateStages = () => {
    const funnelId = funnelSelect.value;
    const funnelStages = stages.filter(s => s.funnel_id === funnelId);
    stageSelect.innerHTML = funnelStages.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  };

  funnelSelect.addEventListener('change', updateStages);
  updateStages();

  modal.querySelector('#atf-cancel').addEventListener('click', closeModal);
  modal.querySelector('#atf-save').addEventListener('click', async () => {
    const stageId = stageSelect.value;
    const funnelId = funnelSelect.value;

    const { error } = await supabase.from('contact_funnel').insert({
      company_id: company.id,
      funnel_id: funnelId,
      current_stage_id: stageId
    });

    if (error) {
      if (error.code === '23505') showToast('Esta empresa já está neste funil', 'warning');
      else showToast('Erro ao adicionar: ' + error.message, 'error');
      return;
    }

    showToast('Negociação iniciada! ', 'success');
    closeModal();
    if (onSave) onSave();
  });
}

function showCompanyForm(company = null, onSuccess) {
  const isEdit = !!company;
  const modalTitle = isEdit ? 'Editar Empresa' : 'Nova Empresa';

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display:grid; grid-template-columns: 180px 1fr; gap: 24px;">
      <!-- Preview Column -->
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding:20px; background:var(--bg-primary); border-radius:var(--radius-lg); border:1px dashed var(--border-color)">
        <div style="font-size:var(--font-size-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px">Preview da Marca</div>
        <div id="company-preview-card" class="card" style="width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; gap:12px; transition:all var(--transition-normal)">
          <div id="preview-icon-wrapper" class="avatar-lg" style="background:${company?.avatar_color || '#64748b'}; box-shadow:0 4px 12px rgba(0,0,0,0.1)">
            <span class="material-symbols-outlined" id="preview-icon" style="font-size:32px">${company?.logo_icon || 'corporate_fare'}</span>
          </div>
          <div id="preview-name" style="font-weight:700; font-size:var(--font-size-md); text-align:center; color:var(--text-primary)">${company?.name || 'Nome da Empresa'}</div>
          <div id="preview-industry" style="font-size:var(--font-size-xs); color:var(--text-muted)">${company?.industry || 'Setor'}</div>
        </div>
        <div style="font-size:10px; color:var(--text-muted); text-align:center; line-height:1.4">A cor e o ícone serão usados em todo o sistema para identificar esta empresa.</div>
      </div>

      <!-- Form Column -->
      <form id="company-form" class="form-grid" style="align-content:start">
        <div class="form-group" style="grid-column: 1 / -1">
          <label class="form-label">Nome da Empresa *</label>
          <input type="text" name="name" id="cf-name" value="${company?.name || ''}" required placeholder="Ex: TreinaCons LTDA" class="form-input">
        </div>
        
        <div class="form-row" style="grid-column: 1 / -1">
          <div class="form-group">
            <label class="form-label">Setor / Indústria</label>
            <input type="text" name="industry" id="cf-industry" value="${company?.industry || ''}" placeholder="Ex: Tecnologia, Educação" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Website</label>
            <input type="url" name="website" value="${company?.website || ''}" placeholder="https://exemplo.com" class="form-input">
          </div>
        </div>

        <div class="form-row" style="grid-column: 1 / -1">
          <div class="form-group">
            <label class="form-label">Ícone (Material Symbol)</label>
            <div style="position:relative">
              <input type="text" name="logo_icon" id="cf-icon" value="${company?.logo_icon || 'corporate_fare'}" placeholder="corporate_fare" class="form-input" style="padding-left:36px">
              <span class="material-symbols-outlined" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--text-muted)">search</span>
            </div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:4px">Dica: use nomes como <i>apartment, factory, store, hub</i></div>
          </div>
          <div class="form-group">
            <label class="form-label">Cor da Marca</label>
            <div style="display:flex; gap:8px; align-items:center">
              <input type="color" name="avatar_color" id="cf-color" value="${company?.avatar_color || '#2d2f6f'}" class="form-input" style="padding:2px; height:38px; width:60px; cursor:pointer">
              <input type="text" id="cf-color-hex" value="${company?.avatar_color || '#2d2f6f'}" class="form-input" style="font-family:monospace; font-size:var(--font-size-xs)" maxlength="7">
            </div>
          </div>
        </div>

        <div class="form-actions" style="grid-column: 1 / -1; margin-top:12px">
          <button type="button" class="btn btn-secondary" id="btn-cancel-company">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="flex:1; justify-content:center">${isEdit ? 'Salvar Alterações' : 'Criar Empresa'}</button>
        </div>
      </form>
    </div>
  `;

  const { modal } = openModal({ title: modalTitle, content, size: 'lg' });

  // Real-time Preview Logic
  const inputs = {
    name: modal.querySelector('#cf-name'),
    industry: modal.querySelector('#cf-industry'),
    icon: modal.querySelector('#cf-icon'),
    color: modal.querySelector('#cf-color'),
    colorHex: modal.querySelector('#cf-color-hex')
  };

  const previews = {
    name: modal.querySelector('#preview-name'),
    industry: modal.querySelector('#preview-industry'),
    icon: modal.querySelector('#preview-icon'),
    iconWrapper: modal.querySelector('#preview-icon-wrapper')
  };

  const updatePreview = () => {
    previews.name.textContent = inputs.name.value || 'Nome da Empresa';
    previews.industry.textContent = inputs.industry.value || 'Setor';
    previews.icon.textContent = inputs.icon.value || 'help';
    previews.iconWrapper.style.background = inputs.color.value;
  };

  inputs.name.addEventListener('input', updatePreview);
  inputs.industry.addEventListener('input', updatePreview);
  inputs.icon.addEventListener('input', updatePreview);
  inputs.color.addEventListener('input', (e) => {
    inputs.colorHex.value = e.target.value.toUpperCase();
    updatePreview();
  });
  inputs.colorHex.addEventListener('input', (e) => {
    let hex = e.target.value;
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      inputs.color.value = hex;
      updatePreview();
    }
  });

  const form = modal.querySelector('#company-form');
  modal.querySelector('#btn-cancel-company').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const companyData = Object.fromEntries(formData.entries());

    const name = companyData.name?.trim();
    if (name) {
      let duplicateQuery = supabase.from('companies').select('id, name').ilike('name', name);
      if (isEdit) duplicateQuery = duplicateQuery.neq('id', company.id);
      const { data: existing } = await duplicateQuery.maybeSingle();
      if (existing) {
        showToast(`Já existe uma empresa com o nome "${existing.name}"`, 'warning');
        return;
      }
    }

    let error;
    if (isEdit) {
      const { error: err } = await supabase.from('companies').update(companyData).eq('id', company.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('companies').insert([companyData]);
      error = err;
    }

    if (error) {
      if (error.code === '23505') showToast('Já existe uma empresa com este nome', 'warning');
      else showToast('Erro ao salvar empresa', 'error');
    } else {
      showToast(isEdit ? 'Empresa atualizada' : 'Empresa criada com sucesso', 'success');
      closeModal();
      if (onSuccess) onSuccess();
    }
  });
}

// Helper functions for formatting
function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0 }).format(v);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function renderTasksTab(tasks, companyId, isOverview = false) {
  return `
    ${tasks.length === 0 ? '<div class="empty-state-simple">Nenhuma tarefa aberta.</div>' :
      tasks.slice(0, isOverview ? 5 : 100).map(t => {
        const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
        const isToday = t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString();
        return `
          <div class="task-row" style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light)">
            <input type="checkbox" class="task-check" data-id="${t.id}" ${t.status === 'completed' ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
            <div style="flex:1">
              <div style="font-size:var(--font-size-sm);font-weight:600;${t.status === 'completed' ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${t.title}</div>
              <div style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:8px;margin-top:2px">
                <span style="color:${t.priority === 'urgent' ? 'var(--accent-danger)' : t.priority === 'high' ? 'var(--accent-warning)' : 'var(--text-muted)'}">${t.priority}</span>
                ${t.due_date ? `<span class="${isOverdue ? 'text-danger' : isToday ? 'text-warning' : ''}">${formatDate(t.due_date)}</span>` : ''}
                ${t.profiles?.name ? `<span>• ${t.profiles.name}</span>` : ''}
              </div>
            </div>
            <button class="btn btn-ghost btn-xs btn-delete-task" data-id="${t.id}" title="Excluir Tarefa">
              <span class="material-symbols-outlined" style="font-size:16px;color:var(--accent-danger)">delete</span>
            </button>
          </div>
        `;
      }).join('')}
  `;
}

function renderNotesTab(notes, companyId, isOverview = false) {
  const noteIcons = {
    call: 'call',
    meeting: 'groups',
    email: 'email',
    whatsapp: 'chat',
    internal: 'description'
  };

  return `
    ${notes.length === 0 ? '<div class="empty-state-simple">Nenhuma anotação registrada.</div>' :
      notes.slice(0, isOverview ? 5 : 100).map(n => `
        <div class="note-row" style="padding:10px 0;border-bottom:1px solid var(--border-light);position:relative">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="material-symbols-outlined" style="font-size:14px;color:var(--text-muted)">${noteIcons[n.type] || 'description'}</span>
              <span style="font-size:10px;font-weight:600;color:var(--text-muted)">${n.profiles?.name || 'Sistema'} • ${formatDate(n.created_at)}</span>
            </div>
            <button class="btn btn-ghost btn-xs btn-delete-note" data-id="${n.id}" title="Excluir Nota">
              <span class="material-symbols-outlined" style="font-size:16px;color:var(--accent-danger)">delete</span>
            </button>
          </div>
          <div style="font-size:var(--font-size-sm);white-space:pre-wrap;color:var(--text-secondary)">${n.content}</div>
        </div>
      `).join('')}
  `;
}

function setupTaskHandlers(companyId, container, profiles) {
  document.querySelectorAll('.task-check').forEach(check => {
    check.addEventListener('change', async () => {
      const id = check.dataset.id;
      const status = check.checked ? 'completed' : 'pending';
      await supabase.from('tasks').update({ status }).eq('id', id);
      renderCompanyDetail(container, companyId);
    });
  });

  document.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Deseja excluir esta tarefa?')) {
        await supabase.from('tasks').delete().eq('id', id);
        renderCompanyDetail(container, companyId);
      }
    });
  });
}

function setupNoteHandlers(companyId, container, profiles) {
  document.querySelectorAll('.btn-delete-note').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Deseja excluir esta nota?')) {
        await supabase.from('contact_notes').delete().eq('id', id);
        renderCompanyDetail(container, companyId);
      }
    });
  });
}

async function showTaskForm(companyId, profiles, onSave) {
  const { data: { user } } = await supabase.auth.getUser();

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Título da Tarefa *</label>
      <input class="form-input" id="task-title" placeholder="O que precisa ser feito?" />
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-textarea" id="task-description" rows="2"></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Prioridade</label>
        <select class="form-select" id="task-priority">
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
          <option value="low">Baixa</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data Limite</label>
        <input class="form-input" id="task-due" type="date" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Responsável</label>
      <select class="form-select" id="task-assignee">
        ${(profiles || []).map(p => `<option value="${p.id}" ${p.id === user?.id ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>
    </div>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="btn btn-secondary" id="task-cancel">Cancelar</button><button class="btn btn-primary" id="task-save">Salvar Tarefa</button>`;

  const { modal } = openModal({ title: 'Nova Tarefa', content, footer });

  modal.querySelector('#task-cancel').addEventListener('click', closeModal);
  modal.querySelector('#task-save').addEventListener('click', async () => {
    const title = modal.querySelector('#task-title').value.trim();
    if (!title) { showToast('Informe o título', 'warning'); return; }

    const { error } = await supabase.from('tasks').insert({
      company_id: companyId,
      title,
      description: modal.querySelector('#task-description').value.trim(),
      priority: modal.querySelector('#task-priority').value,
      due_date: modal.querySelector('#task-due').value || null,
      assigned_to: modal.querySelector('#task-assignee').value,
      user_id: user?.id
    });

    if (error) {
      showToast('Erro ao criar tarefa', 'error');
    } else {
      showToast('Tarefa criada!', 'success');
      closeModal();
      if (onSave) onSave();
    }
  });
}

function showNoteForm(companyId, onSave) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Tipo de Contato</label>
      <select class="form-select" id="note-type">
        <option value="internal">Anotação Interna</option>
        <option value="call">Chamada</option>
        <option value="meeting">Reunião</option>
        <option value="email">Email</option>
        <option value="whatsapp">WhatsApp</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Conteúdo da Nota *</label>
      <textarea class="form-textarea" id="note-content" rows="4" placeholder="Registre o que foi conversado ou observado..."></textarea>
    </div>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="btn btn-secondary" id="note-cancel">Cancelar</button><button class="btn btn-primary" id="note-save">Salvar Nota</button>`;

  const { modal } = openModal({ title: 'Nova Anotação', content, footer });

  modal.querySelector('#note-cancel').addEventListener('click', closeModal);
  modal.querySelector('#note-save').addEventListener('click', async () => {
    const contentText = modal.querySelector('#note-content').value.trim();
    if (!contentText) { showToast('Informe o conteúdo', 'warning'); return; }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('contact_notes').insert({
      company_id: companyId,
      content: contentText,
      type: modal.querySelector('#note-type').value,
      user_id: user?.id
    });

    if (error) {
      showToast('Erro ao criar nota', 'error');
    } else {
      showToast('Anotação salva!', 'success');
      closeModal();
      if (onSave) onSave();
    }
  });
}
