import { supabase } from '../supabase.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export async function renderContacts(container, params) {
  // Check if we should show detail view
  if (params && params.id) {
    return renderContactDetail(container, params.id);
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  const { data: { user } } = await supabase.auth.getUser();

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*, contact_companies(companies(id, name)), contact_funnel(status, funnels(name))')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">close</span></div><div class="empty-state-text">${error.message}</div></div>`;
    return;
  }

  // Extract unique tags and companies for filters
  const allTagsSet = new Set();
  const allCompaniesMap = new Map(); // id -> name

  contacts.forEach(c => {
    if (c.tags) c.tags.forEach(t => allTagsSet.add(t));
    if (c.contact_companies) {
      c.contact_companies.forEach(cc => {
        if (cc.companies) allCompaniesMap.set(cc.companies.id, cc.companies.name);
      });
    } else if (c.company) {
      // Legacy support
      allCompaniesMap.set(c.company_id || c.company, c.company);
    }
  });

  const uniqueTags = Array.from(allTagsSet).sort();
  const sortedCompanies = Array.from(allCompaniesMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  container.innerHTML = `
    <div class="animate-in">
      <div class="page-header">
        <div>
          <h1>Contatos</h1>
          <p class="page-header-sub">${contacts.length} contatos cadastrados</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="btn-new-contact"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">add</span> Novo Contato</button>
        </div>
      </div>
      
      <div class="filters-bar" style="flex-direction:column; align-items:stretch; gap:12px">
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
          <div class="search-bar" style="flex:1; min-width:300px">
            <span class="material-symbols-outlined">search</span>
            <input type="text" id="contact-search" placeholder="Buscar por nome, email ou empresa..." />
          </div>
          
          <select class="form-select" id="contact-source-filter" style="width:auto;min-width:140px">
            <option value="">Fonte: Todas</option>
            <option value="indicação">Indicação</option>
            <option value="prospecção">Prospecção</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="site">Site</option>
            <option value="evento">Evento</option>
            <option value="manual">Manual</option>
          </select>

          <select class="form-select" id="contact-tag-filter" style="width:auto;min-width:140px">
            <option value="">Tag: Todas</option>
            ${uniqueTags.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>

          <select class="form-select" id="contact-company-filter" style="width:auto;min-width:140px">
            <option value="">Empresa: Todas</option>
            ${sortedCompanies.map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}
          </select>

          <select class="form-select" id="contact-funnel-filter" style="width:auto;min-width:140px">
            <option value="">Status Funil: Todos</option>
            <option value="active">Em Negociação</option>
            <option value="won">Ganhou</option>
            <option value="lost">Perdeu</option>
            <option value="none">Sem Funil</option>
          </select>

          <button class="btn btn-ghost btn-sm" id="btn-clear-filters" style="color:var(--accent-danger)">
            <span class="material-symbols-outlined" style="font-size:18px">filter_alt_off</span> Limpar
          </button>
        </div>

        <div style="display:flex; justify-content:flex-end">
          <div class="form-check form-switch" style="display:flex;align-items:center;gap:8px">
            <input class="form-check-input" type="checkbox" id="my-contacts-toggle">
            <label class="form-check-label" for="my-contacts-toggle" style="font-size:var(--font-size-sm);font-weight:600;color:var(--text-secondary);cursor:pointer">Apenas meus contatos</label>
          </div>
        </div>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <table class="data-table" id="contacts-table">
          <thead>
            <tr>
              <th>Contato</th>
              <th>Empresa</th>
              <th>Telefone</th>
              <th>Fonte</th>
              <th>Funis</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody id="contacts-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  function renderTable(filteredContacts) {
    const tbody = document.getElementById('contacts-tbody');
    if (filteredContacts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="padding:40px"><div class="empty-state-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">search</span></div><div class="empty-state-text">Nenhum contato encontrado</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = filteredContacts.map(c => `
      <tr onclick="window.location.hash='#/contacts/${c.id}'" style="cursor:pointer">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar avatar-sm" style="background:${c.avatar_color || '#6366f1'}">${getInitials(c.name)}</div>
            <div>
              <div style="font-weight:600">${c.name}</div>
              <div style="font-size:var(--font-size-xs); color:var(--text-muted)">${c.email || ''}</div>
            </div>
          </div>
        </td>
        <td>
          ${(c.contact_companies || []).length > 0
        ? c.contact_companies.map(cc => cc.companies?.name).filter(Boolean).join(', ')
        : (c.company || '—')}
        </td>
        <td>${formatPhone(c.phone) || '—'}</td>
        <td><span class="badge badge-neutral">${c.source || '—'}</span></td>
        <td>
          ${(c.contact_funnel || []).map(cf =>
          `<span class="badge ${cf.status === 'won' ? 'badge-success' : cf.status === 'lost' ? 'badge-danger' : 'badge-primary'}" style="margin:1px">${cf.funnels?.name?.replace('Funil - ', '') || ''}</span>`
        ).join('')}
        </td>
        <td>${(c.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</td>
      </tr>
    `).join('');
  }

  renderTable(contacts);

  const applyFilters = () => {
    const q = document.getElementById('contact-search').value.toLowerCase();
    const sourceFilter = document.getElementById('contact-source-filter').value;
    const tagFilter = document.getElementById('contact-tag-filter').value;
    const companyFilter = document.getElementById('contact-company-filter').value;
    const funnelFilter = document.getElementById('contact-funnel-filter').value;
    const onlyMy = document.getElementById('my-contacts-toggle')?.checked;

    const filtered = contacts.filter(c => {
      const matchSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.contact_companies || []).some(cc => (cc.companies?.name || '').toLowerCase().includes(q));

      const matchSource = !sourceFilter || c.source === sourceFilter;
      const matchTag = !tagFilter || (c.tags || []).includes(tagFilter);
      const matchCompany = !companyFilter ||
        (c.company_id === companyFilter) ||
        (c.contact_companies || []).some(cc => cc.companies?.id === companyFilter);

      let matchFunnel = true;
      if (funnelFilter === 'none') {
        matchFunnel = (c.contact_funnel || []).length === 0;
      } else if (funnelFilter === 'active') {
        matchFunnel = (c.contact_funnel || []).some(cf => !['won', 'lost'].includes(cf.status));
      } else if (funnelFilter) {
        matchFunnel = (c.contact_funnel || []).some(cf => cf.status === funnelFilter);
      }

      const matchOwner = !onlyMy || c.user_id === user?.id;

      return matchSearch && matchSource && matchTag && matchCompany && matchFunnel && matchOwner;
    });
    renderTable(filtered);
  };

  // Event Listeners
  document.getElementById('contact-search').addEventListener('input', applyFilters);
  document.getElementById('contact-source-filter').addEventListener('change', applyFilters);
  document.getElementById('contact-tag-filter').addEventListener('change', applyFilters);
  document.getElementById('contact-company-filter').addEventListener('change', applyFilters);
  document.getElementById('contact-funnel-filter').addEventListener('change', applyFilters);
  document.getElementById('my-contacts-toggle').addEventListener('change', applyFilters);

  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('contact-search').value = '';
    document.getElementById('contact-source-filter').value = '';
    document.getElementById('contact-tag-filter').value = '';
    document.getElementById('contact-company-filter').value = '';
    document.getElementById('contact-funnel-filter').value = '';
    document.getElementById('my-contacts-toggle').checked = false;
    applyFilters();
  });

  // New contact  
  document.getElementById('btn-new-contact').addEventListener('click', () => {
    showContactForm(null, () => renderContacts(container, params));
  });

  // Check if should open new contact form
  if (params?.new === 'true') {
    const initialData = params.company_id ? { company_id: params.company_id } : null;
    showContactForm(initialData, () => renderContacts(container, params));
  }
  if (window.location.hash.includes('new=1')) {
    showContactForm(null, () => renderContacts(container, {}));
  }
}

export async function renderContactDetail(container, contactId) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  const results = await Promise.all([
    supabase.from('contacts').select('*, superior:reports_to(id, name)').eq('id', contactId).single(),
    supabase.from('contact_funnel').select('*, funnels(name, products(name, icon, color)), funnel_stages:current_stage_id(name, color, position), contact_funnel_history(*, from_stage:from_stage_id(name), to_stage:to_stage_id(name))').eq('contact_id', contactId).order('entered_at', { ascending: false }),
    supabase.from('purchases').select('*, products(name, icon)').eq('contact_id', contactId).order('purchase_date', { ascending: false }),
    supabase.from('products').select('*').eq('active', true),
    supabase.from('tasks').select('*, funnels(name), profiles:assigned_to(name, email)').eq('contact_id', contactId).order('created_at', { ascending: false }),
    supabase.from('contact_notes').select('*, profiles:assigned_to(name, email)').eq('contact_id', contactId).order('created_at', { ascending: false }),
    supabase.from('purchase_participants').select('*, purchases(*, products(name, icon))').eq('contact_id', contactId),
    supabase.from('profiles').select('id, name, email').order('name'),
    supabase.from('contacts').select('id, name').eq('reports_to', contactId),
    supabase.from('contact_companies').select('*, companies(*)').eq('contact_id', contactId)
  ]);

  const [
    contactData,
    funnelEntries,
    purchaseData,
    allProducts,
    tasks,
    notes,
    participationsData,
    profilesData,
    subordinatesData,
    contactCompaniesData
  ] = results.map(r => r.data);

  const contact = contactData;
  const subordinates = subordinatesData || [];
  const contactCompanies = contactCompaniesData || [];
  const participations = participationsData || [];
  const profiles = profilesData || [];

  if (!contact) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><span class="material-symbols-outlined">help_outline</span></div><div class="empty-state-title">Contato não encontrado</div></div>`;
    return;
  }

  // Find recommended products (smarter logic with tags)
  const purchasedProducts = (purchaseData || []).map(p => p.products);
  const purchasedIds = new Set(purchasedProducts.filter(Boolean).map(p => p.id));

  const userInterests = new Set();
  purchasedProducts.forEach(p => {
    if (p && p.tags) p.tags.forEach(t => userInterests.add(t));
  });

  const recommended = (allProducts || [])
    .filter(p => !purchasedIds.has(p.id))
    .map(p => {
      // Calculate relevance score based on tag overlap
      const overlap = (p.tags || []).filter(t => userInterests.has(t)).length;
      return { ...p, relevance: overlap };
    })
    .sort((a, b) => b.relevance - a.relevance || b.price - a.price);

  const noteIcons = { note: '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">notes</span>', call: '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">call</span>', email: '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">mail</span>', meeting: '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">handshake</span>', whatsapp: '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">forum</span>' };

  container.innerHTML = `
    <div class="animate-in">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:16px">
          <button class="btn btn-ghost" onclick="window.location.hash='#/contacts'">← Voltar</button>
          <h1>${contact.name}</h1>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btn-edit-contact"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">edit</span> Editar</button>
          <button class="btn btn-danger btn-sm" id="btn-delete-contact"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">delete</span> Excluir</button>
        </div>
      </div>

      <div class="contact-detail-grid">
        <div class="contact-sidebar">
          <div class="card contact-profile-card">
            <div class="avatar avatar-lg" style="background:${contact.avatar_color || '#6366f1'}">${getInitials(contact.name)}</div>
            <div class="contact-profile-name">${contact.name}</div>
            <div class="contact-profile-company">
              ${contactCompanies.length > 0
      ? contactCompanies.map(cc => `<a href="#/companies/${cc.companies.id}">${cc.companies.name}</a>`).join(', ')
      : (contact.company || '')}
            </div>
            <div class="contact-profile-position">${contact.position || ''}</div>
          </div>
          <div class="card">
            <h4 class="card-title" style="margin-bottom:12px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">push_pin</span> Informações</h4>
            <ul class="contact-info-list">
              ${contact.email ? `<li class="contact-info-item"><span class="info-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">mail</span></span>${contact.email}</li>` : ''}
              ${contact.phone ? `<li class="contact-info-item"><span class="info-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">smartphone</span></span>${formatPhone(contact.phone)}</li>` : ''}
              ${contact.cpf ? `<li class="contact-info-item"><span class="info-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">badge</span></span>CPF: ${formatCpf(contact.cpf)}</li>` : ''}
              ${contactCompanies.length > 0 ? contactCompanies.map(cc => `
                <li class="contact-info-item">
                  <span class="info-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">business</span></span>
                  <strong>${cc.position || 'Empresa'}:</strong> <a href="#/companies/${cc.companies.id}">${cc.companies.name}</a>
                </li>
              `).join('') : (contact.company ? `<li class="contact-info-item"><span class="info-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">business</span></span>${contact.company}</li>` : '')}
              ${contact.source ? `<li class="contact-info-item"><span class="info-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">link</span></span>${contact.source}</li>` : ''}
              ${contact.birth_date ? `<li class="contact-info-item"><span class="info-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">cake</span></span>${formatDate(contact.birth_date)}</li>` : ''}
              ${contact.superior ? `<li class="contact-info-item"><span class="info-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">account_tree</span></span><strong>Superior:</strong> <a href="#/contacts/${contact.superior.id}">${contact.superior.name}</a></li>` : ''}
            </ul>
            ${(contact.tags || []).length > 0 ? `<div style="margin-top:12px">${contact.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
          </div>

          <div class="card">
            <h4 class="card-title" style="margin-bottom:12px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">shopping_bag</span> Compras</h4>
            ${(purchaseData || []).length === 0 ? '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">Nenhuma compra registrada</p>' :
      (purchaseData || []).map(p => `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px;background:var(--bg-input);border-radius:var(--radius-md)">
                  <span class="material-symbols-outlined" style="font-size: 20px;">${p.products?.icon || 'inventory_2'}</span>
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:var(--font-size-sm)">${p.products?.name || 'Produto'}</div>
                    <div style="font-size:var(--font-size-xs);color:var(--text-muted)">${formatDate(p.purchase_date)}</div>
                  </div>
                  <span style="font-weight:700;color:var(--accent-success);font-size:var(--font-size-sm)">R$ ${formatCurrency(p.amount)}</span>
                </div>
              `).join('')
    }
          </div>

          ${recommended.length > 0 ? `
          <div class="card">
            <h4 class="card-title" style="margin-bottom:12px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">lightbulb</span> Recomendações</h4>
            ${recommended.slice(0, 2).map(p => `
              <div class="recommendation-card" style="padding:8px;margin-bottom:8px">
                <span class="recommendation-icon material-symbols-outlined" style="width:32px;height:32px;font-size:18px">${p.icon || 'inventory_2'}</span>
                <div class="recommendation-info">
                  <div class="recommendation-name" style="font-size:var(--font-size-xs)">${p.name}</div>
                  <div class="recommendation-reason" style="font-size:10px">R$ ${formatCurrency(p.price)}</div>
                </div>
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${subordinates && subordinates.length > 0 ? `
          <div class="card">
            <h4 class="card-title" style="margin-bottom:12px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">groups</span> Time / Subordinados</h4>
            ${subordinates.map(s => `
              <div style="padding:8px; margin-bottom:4px; background:var(--bg-input); border-radius:var(--radius-sm); font-size:var(--font-size-sm)">
                <a href="#/contacts/${s.id}" style="font-weight:600">${s.name}</a>
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>

        <div class="contact-main">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- Opportunities Panel -->
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-main);"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:4px">sync</span> Oportunidades</h3>
              </div>
              <div id="contact-funnels-list">
                ${renderFunnelsTab(funnelEntries || [])}
              </div>
              
              <div style="margin-top:24px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                  <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-main);"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:4px">school</span> Treinamentos via Empresa</h3>
                </div>
                <div class="card" style="padding: 16px;">
                  ${!participations || participations.length === 0 ?
      '<p style="color:var(--text-muted);font-size:var(--font-size-sm);text-align:center;padding:10px">Nenhum treinamento registrado.</p>' :
      participations.map(pp => `
                      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-bottom:1px solid var(--border-color)">
                        <div style="display:flex;align-items:center;gap:10px">
                          <span class="material-symbols-outlined" style="color:var(--accent-primary)">${pp.purchases?.products?.icon || 'school'}</span>
                          <div>
                            <div style="font-weight:600;font-size:var(--font-size-sm)">${pp.purchases?.products?.name || 'Treinamento'}</div>
                            <div style="font-size:10px;color:var(--text-muted)">Data: ${new Date(pp.purchases?.purchase_date).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <span class="badge badge-success" style="font-size:10px">Confirmado</span>
                      </div>
                    `).join('')}
                </div>
              </div>

              <div style="margin-top:24px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                  <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-main);"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:4px">history</span> Histórico</h3>
                </div>
                <div class="card" style="max-height: 400px; overflow-y: auto; padding: 16px;">
                  ${renderHistoryTab(funnelEntries || [])}
                </div>
              </div>
            </div>

            <!-- Tasks & Notes Panel -->
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-main);"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:4px">check_circle</span> Atividades</h3>
                <button class="btn btn-primary btn-xs" id="btn-add-task-overview"><span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">add</span> Tarefa</button>
              </div>
              <div class="card" style="margin-bottom:20px; padding: 16px;">
                ${renderTasksTab(tasks || [], contactId, true)}
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-main);"><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:4px">notes</span> Anotações</h3>
                <button class="btn btn-secondary btn-xs" id="btn-add-note-overview"><span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">add</span> Nota</button>
              </div>
              <div class="card" style="padding: 16px;">
                ${renderNotesTab(notes || [], noteIcons, contactId, true)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize handlers for the new layout
  setupTaskHandlers(contactId, container, profiles);
  setupNoteHandlers(contactId, container, profiles);
  setupFunnelHandlers(contactId, container);

  // Custom button handlers for the overview
  const addTaskBtn = document.getElementById('btn-add-task-overview');
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => showTaskForm(contactId, profiles, () => renderContactDetail(container, contactId)));
  }

  const addNoteBtn = document.getElementById('btn-add-note-overview');
  if (addNoteBtn) {
    // Reuse the logic from setupNoteHandlers but explicitly triggered from here
    addNoteBtn.addEventListener('click', () => {
      document.getElementById('btn-add-note')?.click();
    });
  }

  // Edit
  document.getElementById('btn-edit-contact').addEventListener('click', () => {
    showContactForm(contact, () => renderContactDetail(container, contactId));
  });

  // Delete
  const deleteBtn = document.getElementById('btn-delete-contact');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const content = document.createElement('div');
      content.innerHTML = `<p>Tem certeza que deseja excluir o contato <strong>${contact.name}</strong>?</p><p style="margin-top:8px;color:var(--accent-danger);font-size:var(--font-size-xs)">Esta ação excluirá também todas as notas, tarefas e participações vinculadas e não pode ser desfeita.</p>`;

      const footer = document.createElement('div');
      footer.innerHTML = `
        <button class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
        <button class="btn btn-danger" id="confirm-delete">Excluir Permanentemente</button>
      `;

      const { modal: confirmModal } = openModal({ title: 'Confirmar Exclusão', content, footer });

      confirmModal.querySelector('#confirm-cancel').addEventListener('click', closeModal);
      confirmModal.querySelector('#confirm-delete').addEventListener('click', async () => {
        try {
          confirmModal.querySelector('#confirm-delete').disabled = true;
          confirmModal.querySelector('#confirm-delete').innerHTML = '<div class="spinner btn-spinner"></div> Excluindo...';

          const { error } = await supabase.from('contacts').delete().eq('id', contactId);
          if (error) throw error;

          closeModal();
          showToast('Contato excluído com sucesso', 'success');
          window.location.hash = '#/contacts';
        } catch (error) {
          console.error('Error deleting contact:', error);
          showToast('Erro ao excluir contato: ' + error.message, 'error');
          closeModal();
        }
      });
    });
  }
}

function renderFunnelsTab(entries) {
  if (entries.length === 0) {
    return '<div class="empty-state"><div class="empty-state-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">sync</span></div><div class="empty-state-text">Este contato não está em nenhum funil</div></div>';
  }
  return entries.map(cf => `
    <div class="card" style="margin-bottom:12px; position:relative">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="material-symbols-outlined" style="font-size: 20px;">${cf.funnels?.products?.icon || 'inventory_2'}</span>
          <div>
            <div style="font-weight:700">${cf.funnels?.products?.name || cf.funnels?.name || 'Funil'}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">${cf.funnels?.name}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${cf.status === 'won' ? 'badge-success' : cf.status === 'lost' ? 'badge-danger' : cf.status === 'paused' ? 'badge-warning' : 'badge-primary'}">
            ${cf.status === 'won' ? '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span> Ganho' : cf.status === 'lost' ? '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">close</span> Perdido' : cf.status === 'paused' ? '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">pause_circle</span> Pausado' : '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">sync</span> Ativo'}
          </span>
          <button class="btn btn-ghost btn-xs btn-remove-funnel" data-cf-id="${cf.id}" title="Remover do funil">
            <span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent-danger)">delete</span>
          </button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;padding:8px 0;border-bottom:1px solid var(--border-light);margin-bottom:8px">
        <span style="font-size:var(--font-size-sm);color:var(--text-secondary)">Etapa atual:</span>
        <span class="badge" style="background:${cf.funnel_stages?.color || '#6366f1'}22;color:${cf.funnel_stages?.color || '#6366f1'}">${cf.funnel_stages?.name || '—'}</span>
      </div>
      <div style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:4px">
        <span class="material-symbols-outlined" style="font-size:12px">calendar_month</span> Entrou em: ${formatDate(cf.entered_at)}
      </div>
    </div>
  `).join('');
}

function setupFunnelHandlers(contactId, container) {
  document.querySelectorAll('.btn-remove-funnel').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cfId = btn.getAttribute('data-cf-id');
      if (!cfId) return;

      const content = document.createElement('div');
      content.innerHTML = `<p>Deseja remover este contato do funil?</p>`;

      const footer = document.createElement('div');
      footer.innerHTML = `
        <button class="btn btn-secondary" id="remove-cancel">Cancelar</button>
        <button class="btn btn-danger" id="remove-confirm">Remover</button>
      `;

      const { modal: rmModal } = openModal({ title: 'Remover do Funil', content, footer });

      rmModal.querySelector('#remove-cancel').addEventListener('click', closeModal);
      rmModal.querySelector('#remove-confirm').addEventListener('click', async () => {
        try {
          const { error } = await supabase.from('contact_funnel').delete().eq('id', cfId);
          if (error) throw error;

          closeModal();
          showToast('Removido do funil com sucesso', 'success');
          renderContactDetail(container, contactId);
        } catch (error) {
          console.error('Error removing from funnel:', error);
          showToast('Erro ao remover do funil', 'error');
          closeModal();
        }
      });
    });
  });
}

function renderTasksTab(tasks, contactId, isOverview = false) {
  return `
    ${!isOverview ? `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary btn-sm" id="btn-add-task"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">add</span> Nova Tarefa</button>
    </div>` : ''}
    ${tasks.length === 0 ? '<div class="empty-state" style="padding:20px"><div class="empty-state-icon" style="font-size:24px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span></div><div class="empty-state-text">Nenhuma tarefa</div></div>' :
      tasks.slice(0, isOverview ? 5 : 100).map(t => {
        const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
        const isToday = t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString();
        return `
          <div class="task-item" style="padding: 8px 0; border-bottom: 1px solid var(--border-light)">
            <div class="task-checkbox ${t.status === 'completed' ? 'checked' : ''}" data-task-id="${t.id}" style="width:18px;height:18px"></div>
            <div class="task-content">
              <div class="task-title ${t.status === 'completed' ? 'completed' : ''}" style="font-size:var(--font-size-sm)">${t.title}</div>
              <div class="task-meta">
                <span class="badge" style="font-size:9px; padding: 1px 4px; background: ${t.priority === 'urgent' ? 'var(--accent-danger)22' : t.priority === 'high' ? 'var(--accent-warning)22' : 'var(--bg-input)'}; color: ${t.priority === 'urgent' ? 'var(--accent-danger)' : t.priority === 'high' ? 'var(--accent-warning)' : 'var(--text-muted)'}">${t.priority}</span>
                ${t.due_date ? `<span class="task-due ${isOverdue ? 'overdue' : isToday ? 'today' : 'upcoming'}" style="font-size:10px">${formatDate(t.due_date)}</span>` : ''}
                ${t.profiles ? `<span style="font-size:10px; color:var(--text-muted); margin-left:8px"><span class="material-symbols-outlined" style="font-size: 12px; vertical-align: middle;">person</span> ${t.profiles.name}</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('')
    }
  `;
}

function renderHistoryTab(entries) {
  const allHistory = [];
  entries.forEach(cf => {
    (cf.contact_funnel_history || []).forEach(h => {
      allHistory.push({ ...h, funnelName: cf.funnels?.name || '', productIcon: cf.funnels?.products?.icon || 'inventory_2' });
    });
  });
  allHistory.sort((a, b) => new Date(b.moved_at) - new Date(a.moved_at));

  if (allHistory.length === 0) {
    return '<div class="empty-state"><div class="empty-state-icon"><span class="material-symbols-outlined">history</span></div><div class="empty-state-text">Nenhum histórico de movimentação</div></div>';
  }

  return `
    <div class="timeline">
      ${allHistory.map(h => `
        <div class="timeline-item">
          <div class="timeline-item-time">${formatDateTime(h.moved_at)}</div>
          <div class="timeline-item-content">
            <span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">${h.productIcon}</span>
            <strong>${h.funnelName.replace('Funil - ', '')}</strong>:
            <span class="badge badge-neutral">${h.from_stage?.name || '—'}</span>
            → <span class="badge badge-primary">${h.to_stage?.name || '—'}</span>
            ${h.notes ? `<div style="margin-top:4px;font-size:var(--font-size-sm);color:var(--text-muted)">${h.notes}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderNotesTab(notes, noteIcons, contactId, isOverview = false) {
  return `
    ${!isOverview ? `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary btn-sm" id="btn-add-note"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">add</span> Nova Nota</button>
    </div>` : '<button id="btn-add-note" style="display:none"></button>'}
    ${notes.length === 0 ? '<div class="empty-state" style="padding:20px"><div class="empty-state-icon" style="font-size:24px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">notes</span></div><div class="empty-state-text">Nenhuma nota</div></div>' :
      `<div class="timeline" style="padding-left: 20px;">
        ${notes.slice(0, isOverview ? 3 : 100).map(n => `
          <div class="timeline-item" style="padding-bottom: 16px;">
            <div class="timeline-item-time" style="font-size:10px">${formatDate(n.created_at)}</div>
            <div class="timeline-item-content">
              <div style="display:flex;align-items:center;gap:4px">
                <span>${noteIcons[n.type] || '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">notes</span>'}</span>
                <span style="font-weight:600; font-size: 11px; text-transform: uppercase;">${n.type}</span>
              </div>
              <div style="margin-top:4px; font-size: var(--font-size-sm); color: var(--text-main); line-height: 1.4;">${n.content}</div>
              ${n.profiles ? `<div style="font-size:10px; color:var(--text-muted); margin-top:4px"><span class="material-symbols-outlined" style="font-size: 10px; vertical-align: middle;">person</span> ${n.profiles.name}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>`
    }
  `;
}

function setupTaskHandlers(contactId, container, profiles) {
  document.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', async () => {
      const taskId = cb.dataset.taskId;
      const isCompleted = cb.classList.contains('checked');
      await supabase.from('tasks').update({
        status: isCompleted ? 'pending' : 'completed',
        completed_at: isCompleted ? null : new Date().toISOString()
      }).eq('id', taskId);
      showToast(isCompleted ? 'Tarefa reaberta' : 'Tarefa concluída! ', 'success');
      renderContactDetail(container, contactId);
    });
  });

  const addBtn = document.getElementById('btn-add-task');
  if (addBtn) {
    addBtn.addEventListener('click', () => showTaskForm(contactId, profiles, () => renderContactDetail(container, contactId)));
  }
}

function setupNoteHandlers(contactId, container, profiles) {
  const addBtn = document.getElementById('btn-add-note');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const noteTypes = [
        { id: 'note', label: 'Nota', icon: 'notes' },
        { id: 'call', label: 'Ligação', icon: 'call' },
        { id: 'email', label: 'E-mail', icon: 'mail' },
        { id: 'meeting', label: 'Reunião', icon: 'handshake' },
        { id: 'whatsapp', label: 'WhatsApp', icon: 'forum' }
      ];

      const content = document.createElement('div');
      content.innerHTML = `
        <div class="form-group">
          <label class="form-label">Tipo de Atividade</label>
          <div class="note-type-picker" style="display:grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px;">
            ${noteTypes.map(t => `
              <button type="button" class="btn btn-ghost btn-note-type ${t.id === 'note' ? 'active' : ''}" data-type="${t.id}" title="${t.label}" style="display:flex; flex-direction:column; align-items:center; gap:4px; padding: 12px 4px; height:auto; border: 1px solid var(--border-color);">
                <span class="material-symbols-outlined">${t.icon}</span>
                <span style="font-size: 10px; font-weight:600;">${t.label}</span>
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="note-type" value="note" />
        </div>
        <div class="form-group">
          <label class="form-label">Conteúdo</label>
          <textarea class="form-textarea" id="note-content" rows="4" placeholder="Escreva sua nota..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Atribuído a</label>
          <select class="form-select" id="note-assignee">
            <option value="">Atribuir a mim mesmo</option>
            ${(profiles || []).map(p => `<option value="${p.id}">${p.name || p.email}</option>`).join('')}
          </select>
        </div>
      `;

      const footer = document.createElement('div');
      footer.innerHTML = `<button class="btn btn-secondary" id="note-cancel">Cancelar</button><button class="btn btn-primary" id="note-save">Salvar</button>`;

      const { modal } = openModal({ title: 'Nova Nota', content, footer });

      // Handle custom picker
      modal.querySelectorAll('.btn-note-type').forEach(btn => {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('.btn-note-type').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          modal.querySelector('#note-type').value = btn.dataset.type;
        });
      });

      modal.querySelector('#note-cancel').addEventListener('click', closeModal);
      modal.querySelector('#note-save').addEventListener('click', async () => {
        const noteContent = modal.querySelector('#note-content').value.trim();
        if (!noteContent) { showToast('Escreva o conteúdo da nota', 'warning'); return; }

        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('contact_notes').insert({
          contact_id: contactId,
          content: noteContent,
          type: modal.querySelector('#note-type').value,
          user_id: user?.id,
          assigned_to: modal.querySelector('#note-assignee').value || user?.id
        });
        closeModal();
        showToast('Nota adicionada! <span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">notes</span>', 'success');
        renderContactDetail(container, contactId);
      });
    });
  }
}

async function showTaskForm(contactId, profiles, onSave) {
  const { data: funnels } = await supabase.from('funnels').select('*, funnel_stages(*)').order('created_at');

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Título *</label>
      <input class="form-input" id="task-title" placeholder="Ex: Enviar proposta comercial" />
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-textarea" id="task-description" rows="3" placeholder="Detalhes da tarefa..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Prioridade</label>
        <select class="form-select" id="task-priority">
          <option value="low">Baixa</option>
          <option value="medium" selected>Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data limite</label>
        <input class="form-input" type="date" id="task-due" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Funil Relacionado</label>
      <select class="form-select" id="task-funnel">
        <option value="">Nenhum</option>
        ${(funnels || []).map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Atribuído a</label>
      <select class="form-select" id="task-assignee">
        <option value="">Atribuir a mim mesmo</option>
        ${(profiles || []).map(p => `<option value="${p.id}">${p.name || p.email}</option>`).join('')}
      </select>
    </div>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="btn btn-secondary" id="task-cancel">Cancelar</button><button class="btn btn-primary" id="task-save">Salvar</button>`;

  const { modal } = openModal({ title: 'Nova Tarefa', content, footer });

  modal.querySelector('#task-cancel').addEventListener('click', closeModal);
  modal.querySelector('#task-save').addEventListener('click', async () => {
    const title = modal.querySelector('#task-title').value.trim();
    if (!title) { showToast('Informe o título da tarefa', 'warning'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('tasks').insert({
      contact_id: contactId,
      funnel_id: modal.querySelector('#task-funnel').value || null,
      title,
      description: modal.querySelector('#task-description').value.trim(),
      priority: modal.querySelector('#task-priority').value,
      due_date: modal.querySelector('#task-due').value || null,
      user_id: user?.id,
      assigned_to: modal.querySelector('#task-assignee').value || user?.id
    });
    closeModal();
    showToast('Tarefa criada! <span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span>', 'success');
    if (onSave) onSave();
  });
}

export async function showContactForm(contact, onSave) {
  try {
    const isEdit = !!contact;
    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9', '#d946ef', '#f97316'];

    // Fetch companies and contacts for hierarchy
    const [
      { data: companies },
      { data: allContacts },
      { data: existingCompanies }
    ] = await Promise.all([
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('contacts').select('id, name').neq('id', contact?.id || '00000000-0000-0000-0000-000000000000').order('name'),
      isEdit ? supabase.from('contact_companies').select('*, companies(name)').eq('contact_id', contact.id) : Promise.resolve({ data: [] })
    ]);

    const currentCompIds = (existingCompanies || []).map(cc => cc.company_id);

    const content = document.createElement('div');
    content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Nome *</label>
      <input class="form-input" id="cf-name" value="${contact?.name || ''}" placeholder="Nome completo" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="cf-email" type="email" value="${contact?.email || ''}" placeholder="email@empresa.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Telefone</label>
        <input class="form-input" id="cf-phone" value="${formatPhone(contact?.phone) || ''}" placeholder="(11) 99999-9999" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">CPF <span style="font-weight:400;color:var(--text-tertiary)">(opcional)</span></label>
      <input class="form-input" id="cf-cpf" value="${formatCpf(contact?.cpf) || ''}" placeholder="000.000.000-00" />
    </div>
    <div class="form-group">
      <label class="form-label">Empresas Vinculadas</label>
      <div id="cf-companies-list" style="margin-bottom:12px">
        ${(existingCompanies || []).map(cc => `
          <div class="company-tag-item" data-id="${cc.company_id}" style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-input);border-radius:var(--radius-sm);margin-bottom:4px">
            <span style="font-size:var(--font-size-sm);font-weight:600">${cc.companies?.name} ${cc.position ? `<span style="font-weight:400;color:var(--text-muted)">(${cc.position})</span>` : ''}</span>
            <button type="button" class="btn-remove-company-link" style="background:none;border:none;color:var(--accent-danger);cursor:pointer"><span class="material-symbols-outlined" style="font-size:18px">close</span></button>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <select class="form-select" id="cf-add-company-select" style="flex:1">
          <option value="">Adicionar empresa...</option>
          ${(companies || []).filter(c => !currentCompIds.includes(c.id)).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <input class="form-input" id="cf-add-company-position" placeholder="Cargo (opcional)" style="flex:1" />
        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-company-link">Adicionar</button>
      </div>
      <div style="font-size:10px; color:var(--text-muted); margin-top:4px">Ou digite o nome abaixo para criar uma nova empresa e vincular:</div>
      <input class="form-input" id="cf-company-name" placeholder="Nova empresa..." style="margin-top:4px" />
    </div>
    <div class="form-group">
      <label class="form-label">Cargo Principal</label>
      <input class="form-input" id="cf-position" value="${contact?.position || ''}" placeholder="Ex: Diretor de RH" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Fonte</label>
        <select class="form-select" id="cf-source">
          <option value="manual" ${contact?.source === 'manual' ? 'selected' : ''}>Manual</option>
          <option value="prospecção" ${contact?.source === 'prospecção' ? 'selected' : ''}>Prospecção</option>
          <option value="instagram" ${contact?.source === 'instagram' ? 'selected' : ''}>Instagram</option>
          <option value="facebook" ${contact?.source === 'facebook' ? 'selected' : ''}>Facebook</option>
          <option value="indicação" ${contact?.source === 'indicação' ? 'selected' : ''}>Indicação</option>
          <option value="linkedin" ${contact?.source === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
          <option value="site" ${contact?.source === 'site' ? 'selected' : ''}>Site</option>
          <option value="evento" ${contact?.source === 'evento' ? 'selected' : ''}>Evento</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tags (separadas por vírgula)</label>
        <input class="form-input" id="cf-tags" value="${(contact?.tags || []).join(', ')}" placeholder="RH, decisor, PME" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data de Nascimento</label>
        <input class="form-input" id="cf-birth-date" type="date" value="${contact?.birth_date || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Reporta-se a</label>
        <select class="form-select" id="cf-reports-to">
          <option value="">Ninguém (topo da hierarquia)</option>
          ${(allContacts || []).map(c => `<option value="${c.id}" ${contact?.reports_to === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
    </div>
  `;

    const footer = document.createElement('div');
    footer.innerHTML = `<button class="btn btn-secondary" id="cf-cancel">Cancelar</button><button class="btn btn-primary" id="cf-save">${isEdit ? 'Salvar' : 'Criar Contato'}</button>`;

    const { modal } = openModal({ title: isEdit ? 'Editar Contato' : 'Novo Contato', content, footer });

    // Phone formatting
    const phoneInput = modal.querySelector('#cf-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        e.target.value = formatPhone(e.target.value);
      });
    }

    // CPF formatting
    const cpfInput = modal.querySelector('#cf-cpf');
    if (cpfInput) {
      cpfInput.addEventListener('input', (e) => {
        e.target.value = formatCpf(e.target.value);
      });
    }

    // Manage company links in the form
    const selectedCompanies = (existingCompanies || []).map(cc => ({ id: cc.company_id, name: cc.companies?.name, position: cc.position }));

    const updateCompanyLinksUI = () => {
      const list = modal.querySelector('#cf-companies-list');
      list.innerHTML = selectedCompanies.map(c => `
      <div class="company-tag-item" data-id="${c.id}" style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-input);border-radius:var(--radius-sm);margin-bottom:4px">
        <span style="font-size:var(--font-size-sm);font-weight:600">${c.name} ${c.position ? `<span style="font-weight:400;color:var(--text-muted)">(${c.position})</span>` : ''}</span>
        <button type="button" class="btn-remove-company-link" data-id="${c.id}" style="background:none;border:none;color:var(--accent-danger);cursor:pointer"><span class="material-symbols-outlined" style="font-size:18px">close</span></button>
      </div>
    `).join('');

      // Refresh dropdown
      const select = modal.querySelector('#cf-add-company-select');
      const usedIds = new Set(selectedCompanies.map(c => c.id));
      select.innerHTML = '<option value="">Adicionar empresa...</option>' +
        (companies || []).filter(c => !usedIds.has(c.id)).map(c => `<option value="${c.id}">${c.name}</option>`).join('');

      list.querySelectorAll('.btn-remove-company-link').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const idx = selectedCompanies.findIndex(sc => sc.id === id);
          if (idx !== -1) {
            selectedCompanies.splice(idx, 1);
            updateCompanyLinksUI();
          }
        });
      });
    };

    modal.querySelector('#btn-add-company-link').addEventListener('click', () => {
      const select = modal.querySelector('#cf-add-company-select');
      const posInput = modal.querySelector('#cf-add-company-position');
      const id = select.value;
      const name = select.options[select.selectedIndex].text;
      const position = posInput.value.trim();

      if (id) {
        selectedCompanies.push({ id, name, position });
        posInput.value = '';
        updateCompanyLinksUI();
      }
    });

    updateCompanyLinksUI();

    modal.querySelector('#cf-cancel').addEventListener('click', closeModal);
    modal.querySelector('#cf-save').addEventListener('click', async () => {
      const name = modal.querySelector('#cf-name').value.trim();
      if (!name) { showToast('Informe o nome do contato', 'warning'); return; }

      const phone = modal.querySelector('#cf-phone').value.trim();
      const sanitizedPhoneValue = sanitizePhone(phone);
      if (sanitizedPhoneValue) {
        let duplicateQuery = supabase.from('contacts').select('id, name, phone').eq('phone', sanitizedPhoneValue);
        if (isEdit) duplicateQuery = duplicateQuery.neq('id', contact.id);
        const { data: existingContact } = await duplicateQuery.maybeSingle();
        if (existingContact) {
          showToast(`Já existe um contato com este telefone: ${existingContact.name}`, 'warning');
          return;
        }
      }

      const cpf = modal.querySelector('#cf-cpf').value.trim();
      const sanitizedCpfValue = sanitizeCpf(cpf);
      if (sanitizedCpfValue) {
        let duplicateQuery = supabase.from('contacts').select('id, name, cpf').eq('cpf', sanitizedCpfValue);
        if (isEdit) duplicateQuery = duplicateQuery.neq('id', contact.id);
        const { data: existingContact } = await duplicateQuery.maybeSingle();
        if (existingContact) {
          showToast(`Já existe um contato com este CPF: ${existingContact.name}`, 'warning');
          return;
        }
      }

      // Logic to handle new company if provided as text but not in dropdown
      const companyName = modal.querySelector('#cf-company-name').value.trim();
      if (companyName) {
        const { data: existingCompany } = await supabase.from('companies').select('id, name').ilike('name', companyName).maybeSingle();
        if (existingCompany) {
          selectedCompanies.push({ id: existingCompany.id, name: existingCompany.name, position: modal.querySelector('#cf-position').value });
        } else {
          const { data: newCompany } = await supabase.from('companies').insert([{ name: companyName }]).select().single();
          if (newCompany) {
            selectedCompanies.push({ id: newCompany.id, name: companyName, position: modal.querySelector('#cf-position').value });
          }
        }
      }

      const primaryCompany = selectedCompanies[0];

      const data = {
        name,
        email: modal.querySelector('#cf-email').value.trim() || null,
        phone: sanitizedPhoneValue || null,
        cpf: sanitizedCpfValue || null,
        company: primaryCompany?.name || null,
        company_id: primaryCompany?.id || null,
        position: modal.querySelector('#cf-position').value.trim() || null,
        source: modal.querySelector('#cf-source').value,
        tags: modal.querySelector('#cf-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        birth_date: modal.querySelector('#cf-birth-date').value || null,
        reports_to: modal.querySelector('#cf-reports-to').value || null,
        avatar_color: contact?.avatar_color || colors[Math.floor(Math.random() * colors.length)]
      };

      const { data: { user } } = await supabase.auth.getUser();

      let finalContactId = contact?.id;
      if (isEdit) {
        await supabase.from('contacts').update(data).eq('id', contact.id);
        showToast('Contato atualizado! <span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span>', 'success');
      } else {
        const { data: newContact, error: insertError } = await supabase.from('contacts').insert({ ...data, user_id: user?.id }).select().single();
        if (insertError) {
          if (insertError.code === '23505') showToast('Já existe um contato com este telefone', 'warning');
          else showToast('Erro ao salvar contato', 'error');
          return;
        }
        finalContactId = newContact?.id;
        showToast('Contato criado! ', 'success');
      }

      if (finalContactId) {
        // Manage company relationships
        // 1. Delete removed ones
        await supabase.from('contact_companies').delete().eq('contact_id', finalContactId);

        // 2. Insert new ones
        if (selectedCompanies.length > 0) {
          await supabase.from('contact_companies').insert(
            selectedCompanies.map(c => ({
              contact_id: finalContactId,
              company_id: c.id,
              position: c.position,
              is_primary: false // We can add primary logic later if needed
            }))
          );
        }
      }

      closeModal();
      if (onSave) onSave();
    });
  } catch (err) {
    console.error('Error in showContactForm:', err);
    showToast('Erro ao abrir formulário: ' + err.message, 'error');
  }
}

function formatDate(d) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
function formatDateTime(d) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0 }).format(v); }
function getInitials(name) { return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(); }

function formatPhone(value) {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 10) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  } else if (value.length > 6) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
  } else if (value.length > 2) {
    return `(${value.slice(0, 2)}) ${value.slice(2)}`;
  } else if (value.length > 0) {
    return `(${value}`;
  }
  return value;
}

function sanitizePhone(value) {
  if (!value) return null;
  return value.replace(/\D/g, "") || null;
}

function formatCpf(value) {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 9) {
    return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
  } else if (value.length > 6) {
    return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
  } else if (value.length > 3) {
    return `${value.slice(0, 3)}.${value.slice(3)}`;
  }
  return value;
}

function sanitizeCpf(value) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? digits : (digits || null);
}
