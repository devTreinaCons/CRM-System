import { supabase } from '../supabase.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const STANDARD_FUNNEL_STAGES = [
  { name: 'Lead',           position: 0, color: '#94a3b8' },
  { name: 'Contatado',      position: 1, color: '#60a5fa' },
  { name: 'Qualificado',    position: 2, color: '#3b82f6' },
  { name: 'Analisando',     position: 3, color: '#f59e0b' },
  { name: 'Negociação',     position: 4, color: '#8b5cf6' },
  { name: 'Fechado Ganho',  position: 5, color: '#10b981' },
  { name: 'Fechado Perdido',position: 6, color: '#ef4444' },
];

async function fixExistingFunnels() {
  const { data: funnels } = await supabase.from('funnels').select('id');
  if (!funnels?.length) return;

  for (const funnel of funnels) {
    const { data: stages } = await supabase.from('funnel_stages').select('*').eq('funnel_id', funnel.id).order('position');
    if (!stages) continue;

    const existingNames = stages.map(s => s.name);
    const missingStages = STANDARD_FUNNEL_STAGES.filter(s => !existingNames.includes(s.name));
    const stagesToReposition = STANDARD_FUNNEL_STAGES.filter(s =>
      existingNames.includes(s.name) && stages.find(e => e.name === s.name)?.position !== s.position
    );

    if (missingStages.length === 0 && stagesToReposition.length === 0) continue;

    // Update positions of existing standard stages (offset first to avoid conflicts)
    for (const standard of stagesToReposition) {
      const existing = stages.find(e => e.name === standard.name);
      await supabase.from('funnel_stages').update({ position: standard.position + 100 }).eq('id', existing.id);
    }
    for (const standard of stagesToReposition) {
      const existing = stages.find(e => e.name === standard.name);
      await supabase.from('funnel_stages').update({ position: standard.position }).eq('id', existing.id);
    }

    // Insert missing stages
    if (missingStages.length > 0) {
      await supabase.from('funnel_stages').insert(
        missingStages.map(s => ({ ...s, funnel_id: funnel.id }))
      );
    }
  }
}

export async function renderProducts(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  const [
    { data: products },
    { data: purchaseCounts }
  ] = await Promise.all([
    supabase.from('products').select('*, funnels(id, name, funnel_stages(count))').order('created_at'),
    supabase.from('purchases').select('product_id').eq('status', 'completed')
  ]);

  fixExistingFunnels();

  const purchaseMap = {};
  (purchaseCounts || []).forEach(p => {
    purchaseMap[p.product_id] = (purchaseMap[p.product_id] || 0) + 1;
  });

  const categories = [...new Set((products || []).map(p => p.category).filter(Boolean))];

  container.innerHTML = `
    <div class="animate-in">
      <div class="page-header">
        <div>
          <h1>Produtos</h1>
          <p class="page-header-sub" id="product-count">${(products || []).length} produtos cadastrados</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="btn-new-product"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">add</span> Novo Produto</button>
        </div>
      </div>

      <div class="card search-filter-card" style="margin-bottom: 24px;">
        <div class="search-row" style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
          <div class="search-box" style="flex: 1; min-width: 250px;">
            <span class="material-symbols-outlined">search</span>
            <input type="text" id="search-products" placeholder="Buscar por nome ou descrição...">
          </div>
          
          <div class="filter-group" style="display: flex; gap: 8px; align-items: center;">
            <select class="form-select btn-sm" id="filter-category" style="width: auto; min-width: 160px; height: 38px;">
              <option value="">Todas Categorias</option>
              ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
            </select>
            
            <select class="form-select btn-sm" id="filter-status" style="width: auto; height: 38px;">
              <option value="all">Todos Status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>

            <button class="btn btn-ghost btn-sm" id="btn-clear-filters" title="Limpar Filtros">
              <span class="material-symbols-outlined">filter_alt_off</span>
            </button>
          </div>
        </div>
      </div>

      <div id="products-grid" class="products-grid">
        <!-- Products will be rendered here -->
      </div>
    </div>
  `;

  const grid = document.getElementById('products-grid');
  const searchInput = document.getElementById('search-products');
  const categoryFilter = document.getElementById('filter-category');
  const statusFilter = document.getElementById('filter-status');
  const clearBtn = document.getElementById('btn-clear-filters');
  const countLabel = document.getElementById('product-count');

  function updateGrid() {
    const searchTerm = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const filtered = (products || []).filter(p => {
      const matchesSearch = !searchTerm ||
        p.name?.toLowerCase().includes(searchTerm) ||
        p.description?.toLowerCase().includes(searchTerm) ||
        (p.tags || []).some(t => t.toLowerCase().includes(searchTerm));

      const matchesCategory = !category || p.category === category;
      const matchesStatus = status === 'all' || (status === 'active' ? p.active : !p.active);

      return matchesSearch && matchesCategory && matchesStatus;
    });

    countLabel.innerText = `${filtered.length} produtos encontrados`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <div class="empty-state-icon"><span class="material-symbols-outlined">inventory_2</span></div>
          <div class="empty-state-title">Nenhum produto encontrado</div>
          <p class="empty-state-text">Tente ajustar seus filtros ou busca.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => `
      <div class="card product-card" style="--product-color: ${p.color}" data-product-id="${p.id}">
        <div class="product-icon material-symbols-outlined">${p.icon || 'inventory_2'}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-description">${p.description || 'Sem descrição'}</div>
        <div class="product-price">R$ ${formatCurrency(p.price)}</div>
        <div class="product-category">
          <span class="badge badge-primary">${p.category || 'Geral'}</span>
          ${p.edition ? `<span class="badge badge-neutral" style="margin-left:4px">${p.edition}</span>` : ''}
          ${!p.active ? '<span class="badge badge-danger" style="margin-left:4px">Inativo</span>' : ''}
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;gap:12px">
            <span style="font-size:var(--font-size-xs);color:var(--text-muted)"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">sync</span> ${(p.funnels || []).length} funil(is)</span>
            <span style="font-size:var(--font-size-xs);color:var(--text-muted)"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">shopping_cart</span> ${purchaseMap[p.id] || 0} venda(s)</span>
          </div>
          ${(p.tags || []).length > 0 ? `
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${p.tags.map(t => `<span class="tag" style="font-size:10px;padding:2px 6px">${t}</span>`).join('')}
          </div>` : ''}
        </div>
        <div style="margin-top:10px;display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm btn-edit-product" data-id="${p.id}"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">edit</span> Editar</button>
          <button class="btn btn-ghost btn-sm btn-find-leads" data-id="${p.id}"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">psychology</span> Leads</button>
          <button class="btn btn-ghost btn-sm btn-delete-product" data-id="${p.id}" style="margin-left:auto;color:var(--accent-danger)" title="Excluir produto"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">delete</span></button>
        </div>
      </div>
    `).join('');

    // Re-attach listeners to dynamic elements
    grid.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const product = products.find(p => p.id === btn.dataset.id);
        if (product) showProductForm(product, () => renderProducts(container));
      });
    });

    grid.querySelectorAll('.btn-find-leads').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const product = products.find(p => p.id === btn.dataset.id);
        if (product) showLeadDiscovery(product, products);
      });
    });

    grid.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const product = products.find(p => p.id === btn.dataset.id);
        if (product) showDeleteProductConfirm(product, () => renderProducts(container));
      });
    });
  } // end updateGrid

  searchInput.addEventListener('input', updateGrid);
  categoryFilter.addEventListener('change', updateGrid);
  statusFilter.addEventListener('change', updateGrid);

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    categoryFilter.value = '';
    statusFilter.value = 'all';
    updateGrid();
  });

  // Initial render
  updateGrid();

  // New product
  document.getElementById('btn-new-product').addEventListener('click', () => {
    showProductForm(null, () => renderProducts(container));
  });
}

function showProductForm(product, onSave) {
  const isEdit = !!product;
  const icons = ['inventory_2', 'target', 'work', 'trending_up', 'emoji_events', 'assignment', 'school', 'lightbulb', 'build', 'star'];

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Nome *</label>
      <input class="form-input" id="pf-name" value="${product?.name || ''}" placeholder="Nome do produto" />
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-textarea" id="pf-desc" rows="3" placeholder="Descrição do produto">${product?.description || ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Preço (R$)</label>
        <input class="form-input" type="number" step="0.01" id="pf-price" value="${product?.price || ''}" placeholder="0.00" />
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select class="form-select" id="pf-category">
          <option value="">Selecione uma categoria</option>
          <option value="Curso corporativo" ${product?.category === 'Curso corporativo' ? 'selected' : ''}>Curso corporativo</option>
          <option value="Cursos abertos" ${product?.category === 'Cursos abertos' ? 'selected' : ''}>Cursos abertos</option>
          <option value="Projetos de consultoria" ${product?.category === 'Projetos de consultoria' ? 'selected' : ''}>Projetos de consultoria</option>
          <option value="Treinamentos" ${product?.category === 'Treinamentos' ? 'selected' : ''}>Treinamentos</option>
          <option value="Programa EXRESULTA" ${product?.category === 'Programa EXRESULTA' ? 'selected' : ''}>Programa EXRESULTA</option>
          <option value="Comunidade Desenho Estratégico" ${product?.category === 'Comunidade Desenho Estratégico' ? 'selected' : ''}>Comunidade Desenho Estratégico</option>
          <option value="Evento EXRESULTA" ${product?.category === 'Evento EXRESULTA' ? 'selected' : ''}>Evento EXRESULTA</option>
          <option value="TeCons" ${product?.category === 'TeCons' ? 'selected' : ''}>TeCons</option>
        </select>
      </div>
    </div>
    <div class="form-group" id="pf-edition-group" style="${['Cursos abertos', 'Programa EXRESULTA', 'Evento EXRESULTA'].includes(product?.category) ? '' : 'display:none'}">
      <label class="form-label">Edição/Turma</label>
      <select class="form-select" id="pf-edition">
        <option value="">Nenhuma</option>
        ${Array.from({ length: 20 }, (_, i) => i + 1).map(n => `
          <option value="${n}" ${product?.edition === n ? 'selected' : ''}>${n}</option>
        `).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Características (Tags separadas por vírgula)</label>
      <input class="form-input" id="pf-tags" value="${(product?.tags || []).join(', ')}" placeholder="Ex: Liderança, Vendas, Corporate" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Ícone</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${icons.map(icon => `
            <button type="button" class="btn-icon icon-picker ${product?.icon === icon ? 'active' : ''}" data-icon="${icon}" style="font-size:18px;${product?.icon === icon ? 'border-color:var(--accent-primary);background:rgba(99,102,241,0.1)' : ''}"><span class="material-symbols-outlined">${icon}</span></button>
          `).join('')}
        </div>
        <input type="hidden" id="pf-icon" value="${product?.icon || 'inventory_2'}" />
      </div>
      <div class="form-group">
        <label class="form-label">Cor</label>
        <input class="form-input" type="color" id="pf-color" value="${product?.color || '#6366f1'}" style="height:40px;padding:4px" />
      </div>
    </div>
    ${!isEdit ? `
    <div class="form-group" style="background:var(--bg-input);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-color)">
      <label class="form-label" style="margin-bottom:4px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">sync</span> Funil criado automaticamente</label>
      <p style="font-size:var(--font-size-xs);color:var(--text-muted)">Será criado um funil com as etapas padrão: Lead → Contatado → Qualificado → Analisando → Negociação → Fechado Ganho → Fechado Perdido</p>
    </div>
    ` : ''}
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="btn btn-secondary" id="pf-cancel">Cancelar</button><button class="btn btn-primary" id="pf-save">${isEdit ? 'Salvar' : 'Criar Produto'}</button>`;

  const { modal } = openModal({ title: isEdit ? 'Editar Produto' : 'Novo Produto', content, footer });

  // Icon picker
  modal.querySelectorAll('.icon-picker').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.icon-picker').forEach(b => { b.style.borderColor = ''; b.style.background = ''; });
      btn.style.borderColor = 'var(--accent-primary)';
      btn.style.background = 'rgba(99,102,241,0.1)';
      modal.querySelector('#pf-icon').value = btn.dataset.icon;
    });
  });

  modal.querySelector('#pf-category').addEventListener('change', (e) => {
    const categoriesWithEdition = ['Cursos abertos', 'Programa EXRESULTA', 'Evento EXRESULTA'];
    modal.querySelector('#pf-edition-group').style.display = categoriesWithEdition.includes(e.target.value) ? 'block' : 'none';
  });

  modal.querySelector('#pf-cancel').addEventListener('click', closeModal);
  modal.querySelector('#pf-save').addEventListener('click', async () => {
    const name = modal.querySelector('#pf-name').value.trim();
    if (!name) { showToast('Informe o nome do produto', 'warning'); return; }

    const data = {
      name,
      description: modal.querySelector('#pf-desc').value.trim(),
      price: parseFloat(modal.querySelector('#pf-price').value) || null,
      category: modal.querySelector('#pf-category').value || null,
      edition: parseInt(modal.querySelector('#pf-edition').value) || null,
      icon: modal.querySelector('#pf-icon').value,
      color: modal.querySelector('#pf-color').value,
      tags: modal.querySelector('#pf-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    };

    if (isEdit) {
      await supabase.from('products').update(data).eq('id', product.id);
      showToast('Produto atualizado! <span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span>', 'success');
    } else {
      const { data: newProduct } = await supabase.from('products').insert(data).select().single();

      if (newProduct) {
        const { data: newFunnel } = await supabase.from('funnels').insert({
          product_id: newProduct.id,
          name: `Funil - ${name}`
        }).select().single();

        if (newFunnel) {
          await supabase.from('funnel_stages').insert(
            STANDARD_FUNNEL_STAGES.map(s => ({ ...s, funnel_id: newFunnel.id }))
          );
        }
      }

      showToast('Produto criado! ', 'success');
    }

    closeModal();
    if (onSave) onSave();
  });
}

async function showDeleteProductConfirm(product, onDelete) {
  const funnelCount = (product.funnels || []).length;
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', product.id);

  const content = document.createElement('div');
  content.innerHTML = `
    <p>Tem certeza que deseja excluir o produto <strong>${product.name}</strong>?</p>
    ${funnelCount > 0 ? `<p style="margin-top:10px;color:var(--accent-warning);font-size:var(--font-size-xs)"><span class="material-symbols-outlined" style="font-size:inherit;vertical-align:middle">warning</span> Este produto possui <strong>${funnelCount} funil(is)</strong> vinculado(s). Os funis associados também serão desvinculados.</p>` : ''}
    <p style="margin-top:8px;color:var(--accent-danger);font-size:var(--font-size-xs)">Esta ação não pode ser desfeita.</p>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `
    <button class="btn btn-secondary" id="del-prod-cancel">Cancelar</button>
    <button class="btn btn-danger" id="del-prod-confirm">Excluir Produto</button>
  `;

  const { modal } = openModal({ title: 'Excluir Produto', content, footer });

  modal.querySelector('#del-prod-cancel').addEventListener('click', closeModal);
  modal.querySelector('#del-prod-confirm').addEventListener('click', async () => {
    const btn = modal.querySelector('#del-prod-confirm');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner btn-spinner"></div> Excluindo...';

    const { error } = await supabase.from('products').delete().eq('id', product.id);

    if (error) {
      showToast('Erro ao excluir produto: ' + error.message, 'error');
      closeModal();
    } else {
      showToast('Produto excluído com sucesso', 'success');
      closeModal();
      if (onDelete) onDelete();
    }
  });
}

async function showLeadDiscovery(product, allProducts) {
  if (!product.tags || product.tags.length === 0) {
    showToast('Este produto não possui características definidas para análise.', 'warning');
    return;
  }

  // Fetch purchases and funnel data in parallel
  const [purchasesRes, funnelsRes, contactFunnelRes] = await Promise.all([
    supabase.from('purchases').select('*, contacts(*)').eq('status', 'completed'),
    supabase.from('funnels').select('id, product_id, funnel_stages(id, name, position)'),
    supabase.from('contact_funnel').select('*, contacts(*), funnel_stages(name, position)').eq('status', 'active'),
  ]);

  const allPurchases = purchasesRes.data || [];
  const allFunnels = funnelsRes.data || [];
  const activeContactFunnels = contactFunnelRes.data || [];

  // Etapas consideradas "quase compra" (posição >= 2: Qualificado, Analisando, Negociação)
  const ALMOST_BOUGHT_MIN_POSITION = 2;

  // 1. Contatos que JÁ compraram este produto
  const existingBuyers = new Set(allPurchases.filter(p => p.product_id === product.id).map(p => p.contact_id));

  // 2. Produtos relacionados por tags
  const similarProducts = allProducts.filter(p =>
    p.id !== product.id &&
    p.tags &&
    p.tags.some(tag => product.tags.includes(tag))
  );
  const similarProductIds = new Set(similarProducts.map(p => p.id));

  // Mapa de funis por product_id para lookup rápido
  const funnelsByProduct = {};
  allFunnels.forEach(f => { funnelsByProduct[f.product_id] = f; });

  // IDs dos funis de produtos relacionados
  const similarFunnelIds = new Set(
    similarProducts.map(p => funnelsByProduct[p.id]?.id).filter(Boolean)
  );

  // 3. Leads por compra de produtos relacionados
  const potentialLeadsMap = {};

  allPurchases.forEach(p => {
    if (similarProductIds.has(p.product_id) && !existingBuyers.has(p.contact_id)) {
      if (!potentialLeadsMap[p.contact_id]) {
        potentialLeadsMap[p.contact_id] = {
          contact: p.contacts,
          reasons: [],
          score: 0
        };
      }
      const lead = potentialLeadsMap[p.contact_id];
      const prod = similarProducts.find(sp => sp.id === p.product_id);
      if (prod && !lead.reasons.find(r => r.id === prod.id && r.type === 'compra')) {
        lead.reasons.push({ id: prod.id, name: prod.name, color: prod.color, type: 'compra' });
        const overlap = prod.tags.filter(t => product.tags.includes(t)).length;
        lead.score += overlap * 2;
      }
    }
  });

  // 4. Leads por etapas avançadas em funis de produtos relacionados
  activeContactFunnels.forEach(cf => {
    if (!similarFunnelIds.has(cf.funnel_id)) return;
    if (existingBuyers.has(cf.contact_id)) return;
    if (!cf.contacts || !cf.funnel_stages) return;

    const stagePosition = cf.funnel_stages.position;
    if (stagePosition < ALMOST_BOUGHT_MIN_POSITION) return;

    const funnel = allFunnels.find(f => f.id === cf.funnel_id);
    if (!funnel) return;
    const relatedProduct = similarProducts.find(p => p.id === funnel.product_id);
    if (!relatedProduct) return;

    if (!potentialLeadsMap[cf.contact_id]) {
      potentialLeadsMap[cf.contact_id] = {
        contact: cf.contacts,
        reasons: [],
        score: 0
      };
    }

    const lead = potentialLeadsMap[cf.contact_id];
    const reasonKey = `${relatedProduct.id}-${cf.funnel_stages.name}`;
    if (!lead.reasons.find(r => r.key === reasonKey)) {
      lead.reasons.push({
        id: relatedProduct.id,
        key: reasonKey,
        name: relatedProduct.name,
        color: relatedProduct.color,
        type: 'funil',
        stageName: cf.funnel_stages.name
      });
      const overlap = relatedProduct.tags.filter(t => product.tags.includes(t)).length;
      // Quanto mais avançada a etapa, maior o score
      const stageBonus = stagePosition >= 4 ? 3 : stagePosition >= 3 ? 2 : 1;
      lead.score += overlap + stageBonus;
    }
  });

  const potentialLeads = Object.values(potentialLeadsMap).sort((a, b) => b.score - a.score);

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="margin-bottom:16px">
      <p style="font-size:var(--font-size-sm);color:var(--text-secondary)">
        Analisando contatos que consumiram ou demonstraram interesse em produtos com as características: <strong>${product.tags.join(', ')}</strong>
      </p>
      <div style="display:flex;gap:12px;margin-top:8px">
        <span style="font-size:10px;color:var(--text-muted)"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:4px"></span>Comprou produto relacionado</span>
        <span style="font-size:10px;color:var(--text-muted)"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8b5cf6;margin-right:4px"></span>Avançou no funil de produto relacionado</span>
      </div>
    </div>
    ${potentialLeads.length === 0 ? `
      <div class="empty-state" style="padding:20px">
        <span class="material-symbols-outlined" style="font-size:48px;color:var(--border-color)">psychology</span>
        <p>Não encontramos leads óbvios baseados no histórico atual.</p>
      </div>
    ` : `
      <div style="max-height:400px;overflow-y:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Contato</th>
              <th>Relacionamento Prévio</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${potentialLeads.map(l => `
              <tr>
                <td>
                  <div style="font-weight:600">${l.contact.name}</div>
                  <div style="font-size:10px;color:var(--text-muted)">${l.contact.company || ''}</div>
                </td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${l.reasons.map(r => r.type === 'compra'
                      ? `<span class="badge" title="Comprou: ${r.name}" style="background:#10b98122;color:#10b981;font-size:9px">✓ ${r.name}</span>`
                      : `<span class="badge" title="Etapa '${r.stageName}' em: ${r.name}" style="background:#8b5cf622;color:#8b5cf6;font-size:9px">⟳ ${r.name} (${r.stageName})</span>`
                    ).join('')}
                  </div>
                </td>
                <td>
                  <button class="btn btn-primary btn-xs" onclick="window.location.hash='#/contacts/${l.contact.id}'">Ver Perfil</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="btn btn-secondary" id="ld-close">Fechar</button>`;

  const { modal } = openModal({ title: `Leads Sugeridos: ${product.name}`, content, footer, size: 'lg' });
  modal.querySelector('#ld-close').addEventListener('click', closeModal);
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(v);
}
