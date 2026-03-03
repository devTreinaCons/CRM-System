import { supabase } from '../supabase.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';

export async function renderFunnels(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  const [
    { data: funnels },
    { data: products }
  ] = await Promise.all([
    supabase.from('funnels').select('*, products(name, icon, color, category, edition)').eq('active', true).order('created_at'),
    supabase.from('products').select('*').eq('active', true).order('created_at')
  ]);

  if (!funnels || funnels.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">sync</span></div><div class="empty-state-title">Nenhum funil encontrado</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="animate-in">
      <div class="page-header">
        <div>
          <h1>Funis de Vendas</h1>
          <p class="page-header-sub">Gerencie seus contatos em cada etapa</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="btn-add-to-funnel"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">add</span> Adicionar Contato ao Funil</button>
        </div>
      </div>

      <div class="filters-bar" id="category-filters" style="margin-bottom:12px;border-bottom:1px solid var(--border-color);padding-bottom:12px;gap:8px">
        <button class="filter-chip active" data-category="all">Todos (${funnels.length})</button>
        ${[...new Set(funnels.map(f => f.products?.category).filter(Boolean))].map(cat => {
    const count = funnels.filter(f => f.products?.category === cat).length;
    return `<button class="filter-chip" data-category="${cat}">${cat} (${count})</button>`;
  }).join('')}
      </div>

      <div class="filters-bar" id="extra-filters" style="gap:12px;margin-bottom:12px;align-items:center">
        <select class="form-select" id="edition-filter" style="width:auto;max-width:200px">
          <option value="all">Todas as Edições/Turmas</option>
          ${[...new Set(funnels.map(f => f.products?.edition).filter(e => e !== null && e !== undefined))].sort((a, b) => a - b).map(ed => `
            <option value="${ed}">${ed}</option>
          `).join('')}
        </select>
        
        <div class="form-check form-switch" style="display:flex;align-items:center;gap:8px">
          <input class="form-check-input" type="checkbox" id="toggle-show-all" />
          <label class="form-check-label" for="toggle-show-all" style="font-size:var(--font-size-sm);font-weight:600;color:var(--text-secondary);cursor:pointer">Ver histórico completa (todas edições)</label>
        </div>
        
        <div style="flex:1"></div>
      </div>

      <div class="filters-bar" id="funnel-chips-container" style="gap:8px;padding-top:12px;border-top:1px solid var(--border-color)">
        ${funnels.map((f, i) => `
          <button class="filter-chip funnel-chip ${i === 0 ? 'active' : ''}" data-funnel-id="${f.id}" data-category="${f.products?.category || ''}">
            <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle;">${f.products?.icon || 'inventory_2'}</span> ${f.products?.name || f.name}
          </button>
        `).join('')}
      </div>

      <div id="kanban-container"></div>
    </div>
  `;

  let activeFunnelId = funnels[0].id;

  async function loadKanban(funnelId) {
    activeFunnelId = funnelId;
    const kanbanContainer = document.getElementById('kanban-container');
    kanbanContainer.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

    const [
      { data: stages },
      { data: contactFunnels }
    ] = await Promise.all([
      supabase.from('funnel_stages').select('*').eq('funnel_id', funnelId).order('position'),
      supabase.from('contact_funnel').select('*, contacts(id, name, avatar_color, phone, email), companies(id, name, logo_icon, avatar_color), funnel_stages:current_stage_id(id, name)').eq('funnel_id', funnelId)
    ]);

    // Get pending task counts per contact_funnel
    const cfIds = (contactFunnels || []).map(cf => cf.contact_id);
    const { data: taskCounts } = await supabase
      .from('tasks')
      .select('contact_id, status')
      .eq('funnel_id', funnelId)
      .in('status', ['pending', 'in_progress']);

    const taskCountMap = {};
    (taskCounts || []).forEach(t => {
      taskCountMap[t.contact_id] = (taskCountMap[t.contact_id] || 0) + 1;
    });

    kanbanContainer.innerHTML = `
      <div class="kanban-board">
        ${(stages || []).map(stage => {
      const stageContacts = (contactFunnels || []).filter(cf => cf.current_stage_id === stage.id);
      return `
            <div class="kanban-column" data-stage-id="${stage.id}">
              <div class="kanban-column-header" style="--column-color: ${stage.color}">
                <span class="kanban-column-title" style="color:${stage.color}">${stage.name}</span>
                <span class="kanban-column-count">${stageContacts.length}</span>
              </div>
              <div class="kanban-column-body" data-stage-id="${stage.id}">
                ${stageContacts.map(cf => {
        const isCompany = !!cf.company_id;
        const name = isCompany ? cf.companies?.name : cf.contacts?.name;
        const avatarColor = cf.contacts?.avatar_color || '#6366f1';
        const initials = getInitials(name || '?');
        const link = isCompany ? `#/companies/${cf.company_id}` : `#/contacts/${cf.contacts?.id}`;

        return `
                  <div class="kanban-card" draggable="true" data-cf-id="${cf.id}" data-link="${link}" style="position:relative">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px">
                      <div style="display:flex;align-items:center;gap:8px">
                        ${isCompany ?
            `<div class="avatar avatar-sm" style="background:var(--bg-card);border:1px solid var(--border-color);width:28px;height:28px;color:var(--text-main)"><span class="material-symbols-outlined" style="font-size:16px">business</span></div>` :
            `<div class="avatar avatar-sm" style="background:${avatarColor};width:28px;height:28px;font-size:11px">${initials}</div>`
          }
                        <div class="kanban-card-name">${name || 'Interesse'}</div>
                      </div>
                      <button class="btn btn-ghost btn-xs btn-remove-kanban" data-cf-id="${cf.id}" title="Remover do funil" style="padding:2px; height:auto; min-height:auto; margin-top:-2px">
                        <span class="material-symbols-outlined" style="font-size:16px; color:var(--text-muted)">delete</span>
                      </button>
                    </div>
                    ${!isCompany && cf.contacts?.company ? `<div class="kanban-card-company"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">business</span> ${cf.contacts.company}</div>` : ''}
                    <div class="kanban-card-footer">
                      <span class="kanban-card-time"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">calendar_month</span> ${timeSince(cf.updated_at || cf.entered_at)}</span>
                      ${!isCompany && taskCountMap[cf.contact_id] ? `<span class="kanban-card-tasks"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">assignment</span> ${taskCountMap[cf.contact_id]}</span>` : ''}
                    </div>
                    <div style="margin-top:6px">
                      <span class="badge ${cf.status === 'won' ? 'badge-success' : cf.status === 'lost' ? 'badge-danger' : cf.status === 'paused' ? 'badge-warning' : 'badge-info'}" style="font-size:10px">${cf.status === 'won' ? 'Ganho' : cf.status === 'lost' ? 'Perdido' : cf.status === 'paused' ? 'Pausado' : 'Ativo'}</span>
                      ${isCompany ? '<span class="badge badge-primary" style="font-size:10px;margin-left:4px">Empresa</span>' : ''}
                    </div>
                  </div>
                `;
      }).join('')}
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;

    setupDragAndDrop(funnelId, kanbanContainer, () => loadKanban(activeFunnelId));

    // Click card to go to contact detail
    kanbanContainer.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.drag-handle') || e.target.closest('.btn-remove-kanban')) return;
        const link = card.dataset.link;
        if (link) window.location.hash = link;
      });
    });

    // Remove from funnel handler
    kanbanContainer.querySelectorAll('.btn-remove-kanban').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const cfId = btn.dataset.cfId;
        if (!cfId) return;

        const content = document.createElement('div');
        content.innerHTML = `<p>Deseja remover esta oportunidade do funil?</p><p style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:8px">Isso não excluirá o contato ou a empresa, apenas a negociação neste funil específico.</p>`;

        const footer = document.createElement('div');
        footer.innerHTML = `
          <button class="btn btn-secondary" id="rm-kb-cancel">Cancelar</button>
          <button class="btn btn-danger" id="rm-kb-confirm">Remover</button>
        `;

        const { modal: rmModal } = openModal({ title: 'Remover do Funil', content, footer });

        rmModal.querySelector('#rm-kb-cancel').addEventListener('click', closeModal);
        rmModal.querySelector('#rm-kb-confirm').addEventListener('click', async () => {
          const { error } = await supabase.from('contact_funnel').delete().eq('id', cfId);
          if (error) {
            showToast('Erro ao remover', 'error');
          } else {
            showToast('Removido com sucesso', 'success');
            closeModal();
            loadKanban(activeFunnelId);
          }
        });
      });
    });
  }

  // Edition/Show All filters
  document.getElementById('edition-filter').addEventListener('change', () => applyAllFilters());
  document.getElementById('toggle-show-all').addEventListener('change', () => applyAllFilters());

  function applyAllFilters() {
    const category = document.querySelector('#category-filters .filter-chip.active').dataset.category;
    const edition = document.getElementById('edition-filter').value;
    const showAll = document.getElementById('toggle-show-all').checked;
    const funnelChips = document.querySelectorAll('.funnel-chip');

    // Calculate latest editions per product name
    const latestEditions = {};
    funnels.forEach(f => {
      const p = f.products;
      if (p && p.name) {
        const currentEdition = p.edition !== null ? parseInt(p.edition) : -1;
        if (!latestEditions[p.name] || currentEdition > latestEditions[p.name]) {
          latestEditions[p.name] = currentEdition;
        }
      }
    });

    let firstVisibleFunnelId = null;
    funnelChips.forEach(fc => {
      const funnel = funnels.find(f => f.id === fc.dataset.funnelId);
      const product = funnel.products;

      const categoryMatch = category === 'all' || fc.dataset.category === category;
      const editionMatch = edition === 'all' || (product?.edition !== null && String(product?.edition) === edition);

      // Latest edition logic: if not showAll, only show if this is the max edition for this product name
      let latestMatch = true;
      if (!showAll && product && product.name) {
        const currentEdition = product.edition !== null ? parseInt(product.edition) : -1;
        latestMatch = (currentEdition === latestEditions[product.name]);
      }

      const matches = categoryMatch && editionMatch && latestMatch;
      fc.style.display = matches ? 'flex' : 'none';
      if (matches && !firstVisibleFunnelId) firstVisibleFunnelId = fc.dataset.funnelId;
    });

    const kanbanContainer = document.getElementById('kanban-container');

    // If active funnel is hidden, switch to the first visible one
    const activeFunnelChip = document.querySelector('.funnel-chip.active');
    if (activeFunnelChip && activeFunnelChip.style.display === 'none' && firstVisibleFunnelId) {
      document.querySelector(`.funnel-chip[data-funnel-id="${firstVisibleFunnelId}"]`).click();
    } else if (!firstVisibleFunnelId) {
      kanbanContainer.innerHTML = `
        <div class="empty-state" style="padding:40px">
          <div class="empty-state-icon"><span class="material-symbols-outlined" style="font-size:48px">filter_list_off</span></div>
          <div class="empty-state-title">Nenhum funil encontrado</div>
          <p style="color:var(--text-secondary)">Tente ajustar os filtros ou ative "Ver histórico completo".</p>
        </div>
      `;
    }
  }

  // Category filters
  document.querySelectorAll('#category-filters .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#category-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyAllFilters();
    });
  });

  // Funnel chips
  document.querySelectorAll('.funnel-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.funnel-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadKanban(chip.dataset.funnelId);
    });
  });

  // Add contact/company to funnel
  document.getElementById('btn-add-to-funnel').addEventListener('click', async () => {
    const [
      { data: allContacts },
      { data: allCompanies },
      { data: allStages }
    ] = await Promise.all([
      supabase.from('contacts').select('id, name, contact_companies(companies(id, name))').order('name'),
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('funnel_stages').select('*').eq('funnel_id', activeFunnelId).order('position')
    ]);

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="form-group">
        <label class="form-label">Tipo de Oportunidade</label>
        <div style="display:flex;gap:12px;margin-bottom:12px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="radio" name="entity-type" value="contact" checked /> Pessoa
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="radio" name="entity-type" value="company" /> Empresa
          </label>
        </div>
      </div>
      <div class="form-group" id="group-contact">
        <label class="form-label">Contato</label>
        <select class="form-select" id="atf-contact">
          <option value="">Selecione um contato</option>
          ${(allContacts || []).map(c => `
            <option value="${c.id}" data-companies='${JSON.stringify(c.contact_companies || [])}'>
              ${c.name} ${(c.contact_companies || []).map(cc => `[${cc.companies?.name}]`).join(' ')}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="form-group" id="group-contact-company" style="display:none">
        <label class="form-label">Contexto da Empresa (para este contato)</label>
        <select class="form-select" id="atf-contact-company">
          <option value="">Nenhuma empresa</option>
        </select>
      </div>
      <div class="form-group" id="group-company" style="display:none">
        <label class="form-label">Empresa</label>
        <select class="form-select" id="atf-company">
          <option value="">Selecione uma empresa</option>
          ${(allCompanies || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Etapa inicial</label>
        <select class="form-select" id="atf-stage">
          ${(allStages || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
    `;

    const footer = document.createElement('div');
    footer.innerHTML = `<button class="btn btn-secondary" id="atf-cancel">Cancelar</button><button class="btn btn-primary" id="atf-save">Adicionar</button>`;

    const { modal } = openModal({ title: 'Adicionar ao Funil', content, footer });

    // Switch between contact and company selects
    modal.querySelectorAll('input[name="entity-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'contact') {
          modal.querySelector('#group-contact').style.display = 'block';
          modal.querySelector('#group-company').style.display = 'none';
        } else {
          modal.querySelector('#group-contact').style.display = 'none';
          modal.querySelector('#group-company').style.display = 'block';
        }
      });
    });

    modal.querySelector('#atf-contact').addEventListener('change', (e) => {
      const contactId = e.target.value;
      const contact = allContacts.find(c => c.id === contactId);
      const companySelect = modal.querySelector('#atf-contact-company');
      const companyGroup = modal.querySelector('#group-contact-company');

      if (contact && contact.contact_companies && contact.contact_companies.length > 0) {
        companyGroup.style.display = 'block';
        companySelect.innerHTML = contact.contact_companies.map(cc =>
          `<option value="${cc.companies.id}">${cc.companies.name}</option>`
        ).join('');
      } else {
        companyGroup.style.display = 'none';
        companySelect.innerHTML = '<option value="">Nenhuma empresa</option>';
      }
    });

    modal.querySelector('#atf-cancel').addEventListener('click', closeModal);
    modal.querySelector('#atf-save').addEventListener('click', async () => {
      const type = modal.querySelector('input[name="entity-type"]:checked').value;
      const contactId = modal.querySelector('#atf-contact').value;
      const contactCompanyId = modal.querySelector('#atf-contact-company').value;
      const companyId = modal.querySelector('#atf-company').value;
      const stageId = modal.querySelector('#atf-stage').value;

      if (type === 'contact' && !contactId) { showToast('Selecione um contato', 'warning'); return; }
      if (type === 'company' && !companyId) { showToast('Selecione uma empresa', 'warning'); return; }

      const payload = {
        funnel_id: activeFunnelId,
        current_stage_id: stageId
      };

      if (type === 'contact') {
        payload.contact_id = contactId;
        // company_id must be null when contact_id is set (DB constraint: funnel_entity_check)
        payload.company_id = null;
      } else {
        payload.company_id = companyId;
        payload.contact_id = null;
      }

      const { error } = await supabase.from('contact_funnel').insert(payload);

      if (error) {
        if (error.code === '23505') showToast('Este contato já está neste funil', 'warning');
        else showToast('Erro ao adicionar: ' + error.message, 'error');
        return;
      }

      closeModal();
      showToast('Contato adicionado ao funil! ', 'success');
      loadKanban(activeFunnelId);
    });
  });

  loadKanban(funnels[0].id);
}

function setupDragAndDrop(funnelId, kanbanContainer, reloadCallback) {
  const cards = kanbanContainer.querySelectorAll('.kanban-card');
  const columns = kanbanContainer.querySelectorAll('.kanban-column-body');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.cfId);
      card.classList.add('dragging');
      setTimeout(() => card.style.opacity = '0.4', 0);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      card.style.opacity = '1';
      columns.forEach(col => col.classList.remove('drag-over'));
    });
  });

  columns.forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');

      const cfId = e.dataTransfer.getData('text/plain');
      const newStageId = col.dataset.stageId;

      if (!cfId || !newStageId) return;

      // Client-side lock to prevent parallel processing for the same card move
      if (window._inProgressDrops?.has(cfId)) return;
      if (!window._inProgressDrops) window._inProgressDrops = new Set();
      window._inProgressDrops.add(cfId);

      try {
        const { data: cfData } = await supabase.from('contact_funnel').select('*, funnels(*, products(*))').eq('id', cfId).single();
        const { data: stageData } = await supabase.from('funnel_stages').select('*').eq('id', newStageId).single();

        if (!cfData || !stageData) return;

        const isWon = stageData.name?.toLowerCase().includes('ganho') || stageData.name?.toLowerCase().includes('fechado');
        const isLost = stageData.name?.toLowerCase().includes('perdido');

        // 1. Always update the stage
        const { error: moveError } = await supabase
          .from('contact_funnel')
          .update({ current_stage_id: newStageId })
          .eq('id', cfId);

        if (moveError) {
          showToast('Erro ao mover contato', 'error');
          return;
        }

        // 2. Atomic Transition: Only trigger purchase if we are moving TO won AND it wasn't won before
        if (isWon) {
          // Atomic update: only succeeds in returning data if the status was NOT 'won' before
          const { data: transitionRow } = await supabase
            .from('contact_funnel')
            .update({ status: 'won' })
            .eq('id', cfId)
            .neq('status', 'won')
            .select();

          // Only proceed if exactly one row was updated (meaning this is the FIRST time it became 'won')
          if (transitionRow && transitionRow.length > 0) {
            const purchasePayload = {
              contact_id: cfData.contact_id,
              company_id: cfData.company_id,
              product_id: cfData.funnels?.product_id,
              amount: cfData.funnels?.products?.price || 0,
              purchase_date: new Date().toISOString().split('T')[0],
              status: 'completed',
              notes: `Venda automática via Funil: ${cfData.funnels?.name}`
            };

            if (purchasePayload.product_id) {
              const { error: pError } = await supabase.from('purchases').insert([purchasePayload]);
              if (pError) console.error('Error creating automatic purchase:', pError);
              else showToast('Venda registrada automaticamente! <span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">paid</span>', 'success');
            }
          }
        } else if (isLost) {
          await supabase.from('contact_funnel').update({ status: 'lost' }).eq('id', cfId);
        } else {
          // If moving back from won/lost to active
          await supabase.from('contact_funnel').update({ status: 'active' }).eq('id', cfId);
        }

        showToast('Contato movido! <span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">sync</span>', 'success');

        // Reload only the current kanban, keeping the active funnel
        if (reloadCallback) reloadCallback();

      } catch (err) {
        console.error('Error in drop handler:', err);
      } finally {
        window._inProgressDrops.delete(cfId);
      }
    });
  });
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function timeSince(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Hoje';
  if (diff === 1) return '1 dia';
  if (diff < 30) return `${diff} dias`;
  if (diff < 365) return `${Math.floor(diff / 30)} meses`;
  return `${Math.floor(diff / 365)} anos`;
}
