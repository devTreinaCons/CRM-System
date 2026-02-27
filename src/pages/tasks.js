import { supabase } from '../supabase.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';

export async function renderTasks(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  const [
    { data: tasks },
    { data: contacts },
    { data: funnels },
    { data: profiles }
  ] = await Promise.all([
    supabase.from('tasks').select('*, contacts(id, name, avatar_color, company), funnels(name, products(name, icon)), profiles:assigned_to(name, email, avatar_color)').order('due_date', { ascending: true }),
    supabase.from('contacts').select('id, name, company').order('name'),
    supabase.from('funnels').select('*, products(name, icon)').order('created_at'),
    supabase.from('profiles').select('id, name, email').order('name')
  ]);

  let filterStatus = 'active'; // active = pending + in_progress
  let filterPriority = '';
  let filterFunnel = '';
  let searchQuery = '';
  let showOnlyMyTasks = false;

  const { data: { user } } = await supabase.auth.getUser();


  container.innerHTML = `
    <div class="animate-in">
      <div class="page-header">
        <div>
          <h1>Demandas</h1>
          <p class="page-header-sub">Gerencie as tarefas dos seus contatos</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="btn-new-task"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">add</span> Nova Demanda</button>
        </div>
      </div>

      <div class="filters-bar">
        <div class="search-bar" style="max-width:300px">
          <span class="material-symbols-outlined">search</span>
          <input type="text" id="task-search" placeholder="Buscar tarefas..." />
        </div>
        <button class="filter-chip active" data-status="active"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">assignment</span> Ativas</button>
        <button class="filter-chip" data-status="pending"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">hourglass_empty</span> Pendentes</button>
        <button class="filter-chip" data-status="in_progress"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">sync</span> Em Andamento</button>
        <button class="filter-chip" data-status="completed"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span> Concluídas</button>
        <button class="filter-chip" data-status=""><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">search</span> Todas</button>
        <select class="form-select" id="filter-priority" style="width:auto;max-width:160px">
          <option value="">Todas prioridades</option>
          <option value="urgent"><span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-danger); vertical-align: middle;">circle</span> Urgente</option>
          <option value="high"><span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-warning); vertical-align: middle;">circle</span> Alta</option>
          <option value="medium"><span class="material-symbols-outlined" style="font-size: inherit; color: #eab308; vertical-align: middle;">circle</span> Média</option>
          <option value="low"><span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-success); vertical-align: middle;">circle</span> Baixa</option>
        </select>
        <select class="form-select" id="filter-funnel" style="width:auto;max-width:200px">
          <option value="">Todos os funis</option>
          ${(funnels || []).map(f => `<option value="${f.id}">${f.products?.icon || 'inventory_2'} - ${f.products?.name || f.name}</option>`).join('')}
        </select>
        
        <div style="flex:1"></div>
        
        <div class="form-check form-switch" style="display:flex;align-items:center;gap:8px">
          <input class="form-check-input" type="checkbox" id="my-tasks-toggle" ${showOnlyMyTasks ? 'checked' : ''}>
          <label class="form-check-label" for="my-tasks-toggle" style="font-size:var(--font-size-sm);font-weight:600;color:var(--text-secondary);cursor:pointer">Apenas minhas</label>
        </div>
      </div>

      <div id="tasks-list"></div>
    </div>
  `;

  function getFilteredTasks() {
    return (tasks || []).filter(t => {
      const matchStatus = !filterStatus ||
        (filterStatus === 'active' ? ['pending', 'in_progress'].includes(t.status) : t.status === filterStatus);
      const matchPriority = !filterPriority || t.priority === filterPriority;
      const matchFunnel = !filterFunnel || t.funnel_id === filterFunnel;
      const matchSearch = !searchQuery ||
        t.title.toLowerCase().includes(searchQuery) ||
        (t.contacts?.name || '').toLowerCase().includes(searchQuery);
      const matchOwner = !showOnlyMyTasks || t.user_id === user?.id;
      return matchStatus && matchPriority && matchFunnel && matchSearch && matchOwner;
    });
  }

  function renderTaskList() {
    const filtered = getFilteredTasks();
    const listEl = document.getElementById('tasks-list');

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span></div><div class="empty-state-title">Nenhuma tarefa encontrada</div><div class="empty-state-text">Tente ajustar os filtros</div></div>';
      return;
    }

    // Group by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = [], todayTasks = [], upcoming = [], noDue = [];

    filtered.forEach(t => {
      if (!t.due_date) { noDue.push(t); return; }
      const d = new Date(t.due_date);
      d.setHours(0, 0, 0, 0);
      if (t.status === 'completed') { upcoming.push(t); }
      else if (d < today) { overdue.push(t); }
      else if (d.getTime() === today.getTime()) { todayTasks.push(t); }
      else { upcoming.push(t); }
    });

    let html = '';

    if (overdue.length > 0) {
      html += `<div style="margin-bottom:20px">
        <h3 style="color:var(--accent-danger);font-size:var(--font-size-base);font-weight:700;margin-bottom:10px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">warning</span> Atrasadas (${overdue.length})</h3>
        ${overdue.map(renderTaskItem).join('')}
      </div>`;
    }

    if (todayTasks.length > 0) {
      html += `<div style="margin-bottom:20px">
        <h3 style="color:var(--accent-warning);font-size:var(--font-size-base);font-weight:700;margin-bottom:10px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">calendar_month</span> Hoje (${todayTasks.length})</h3>
        ${todayTasks.map(renderTaskItem).join('')}
      </div>`;
    }

    if (upcoming.length > 0) {
      html += `<div style="margin-bottom:20px">
        <h3 style="color:var(--accent-info);font-size:var(--font-size-base);font-weight:700;margin-bottom:10px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">assignment</span> Próximas (${upcoming.length})</h3>
        ${upcoming.map(renderTaskItem).join('')}
      </div>`;
    }

    if (noDue.length > 0) {
      html += `<div style="margin-bottom:20px">
        <h3 style="color:var(--text-muted);font-size:var(--font-size-base);font-weight:700;margin-bottom:10px"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">event</span> Sem data (${noDue.length})</h3>
        ${noDue.map(renderTaskItem).join('')}
      </div>`;
    }

    listEl.innerHTML = html;

    // Checkbox handlers
    listEl.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = cb.dataset.taskId;
        const isCompleted = cb.classList.contains('checked');
        await supabase.from('tasks').update({
          status: isCompleted ? 'pending' : 'completed',
          completed_at: isCompleted ? null : new Date().toISOString()
        }).eq('id', taskId);
        // Update local data
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          task.status = isCompleted ? 'pending' : 'completed';
          task.completed_at = isCompleted ? null : new Date().toISOString();
        }
        showToast(isCompleted ? 'Tarefa reaberta' : 'Tarefa concluída! ', 'success');
        renderTaskList();
      });
    });
  }

  function renderTaskItem(t) {
    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
    const isToday = t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString();
    return `
      <div class="task-item" style="cursor:pointer" onclick="window.location.hash='#/contacts/${t.contacts?.id || ''}'">
        <div class="task-checkbox ${t.status === 'completed' ? 'checked' : ''}" data-task-id="${t.id}"></div>
        <div class="task-content">
          <div class="task-title ${t.status === 'completed' ? 'completed' : ''}">${t.title}</div>
          ${t.description ? `<div style="font-size:var(--font-size-sm);color:var(--text-muted);margin:4px 0">${t.description}</div>` : ''}
          <div class="task-meta">
            ${t.contacts ? `
              <span class="task-meta-item" style="display:flex;align-items:center;gap:4px">
                <span class="avatar" style="width:18px;height:18px;font-size:8px;background:${t.contacts.avatar_color || '#6366f1'}">${getInitials(t.contacts.name)}</span>
                ${t.contacts.name}
              </span>
            ` : ''}
            ${t.profiles ? `
              <span class="task-meta-item" style="display:flex;align-items:center;gap:4px" title="Atribuído a ${t.profiles.name}">
                <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">person</span>
                ${t.profiles.name}
              </span>
            ` : ''}
            <span class="badge badge-${t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : t.priority === 'medium' ? 'primary' : 'neutral'}">${priorityLabel(t.priority)}</span>
            ${t.funnels ? `<span class="task-meta-item"><span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 2px;">${t.funnels.products?.icon || 'inventory_2'}</span> ${t.funnels.products?.name || t.funnels.name}</span>` : ''}
            ${t.due_date ? `<span class="task-due ${isOverdue ? 'overdue' : isToday ? 'today' : 'upcoming'}">${isOverdue ? '<span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">warning</span> ' : ''}${formatDate(t.due_date)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // Event listeners
  document.querySelectorAll('.filter-chip[data-status]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-status]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterStatus = chip.dataset.status;
      renderTaskList();
    });
  });

  document.getElementById('filter-priority').addEventListener('change', (e) => {
    filterPriority = e.target.value;
    renderTaskList();
  });

  document.getElementById('filter-funnel').addEventListener('change', (e) => {
    filterFunnel = e.target.value;
    renderTaskList();
  });

  document.getElementById('task-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderTaskList();
  });

  document.getElementById('my-tasks-toggle').addEventListener('change', (e) => {
    showOnlyMyTasks = e.target.checked;
    renderTaskList();
  });


  // New task
  document.getElementById('btn-new-task').addEventListener('click', () => {
    showNewTaskGlobal(contacts, funnels, profiles, () => renderTasks(container));
  });

  renderTaskList();
}

async function showNewTaskGlobal(contacts, funnels, profiles, onSave) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Contato *</label>
      <select class="form-select" id="gt-contact">
        <option value="">Selecione um contato</option>
        ${(contacts || []).map(c => `<option value="${c.id}">${c.name}${c.company ? ` (${c.company})` : ''}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Título *</label>
      <input class="form-input" id="gt-title" placeholder="Ex: Enviar proposta comercial" />
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-textarea" id="gt-description" rows="3" placeholder="Detalhes da tarefa..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Prioridade</label>
        <select class="form-select" id="gt-priority">
          <option value="low"><span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-success); vertical-align: middle;">circle</span> Baixa</option>
          <option value="medium" selected><span class="material-symbols-outlined" style="font-size: inherit; color: #eab308; vertical-align: middle;">circle</span> Média</option>
          <option value="high"><span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-warning); vertical-align: middle;">circle</span> Alta</option>
          <option value="urgent"><span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-danger); vertical-align: middle;">circle</span> Urgente</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data limite</label>
        <input class="form-input" type="date" id="gt-due" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Funil (opcional)</label>
      <select class="form-select" id="gt-funnel">
        <option value="">Nenhum</option>
        ${(funnels || []).map(f => `<option value="${f.id}">${f.products?.icon || 'inventory_2'} - ${f.products?.name || f.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Atribuído a (Vendedor)</label>
      <select class="form-select" id="gt-assignee">
        <option value="">Atribuir a mim mesmo</option>
        ${(profiles || []).map(p => `<option value="${p.id}">${p.name || p.email}</option>`).join('')}
      </select>
    </div>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="btn btn-secondary" id="gt-cancel">Cancelar</button><button class="btn btn-primary" id="gt-save">Criar Demanda</button>`;

  const { modal } = openModal({ title: 'Nova Demanda', content, footer });

  modal.querySelector('#gt-cancel').addEventListener('click', closeModal);
  modal.querySelector('#gt-save').addEventListener('click', async () => {
    const contactId = modal.querySelector('#gt-contact').value;
    const title = modal.querySelector('#gt-title').value.trim();
    if (!contactId) { showToast('Selecione um contato', 'warning'); return; }
    if (!title) { showToast('Informe o título', 'warning'); return; }

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('tasks').insert({
      contact_id: contactId,
      funnel_id: modal.querySelector('#gt-funnel').value || null,
      title,
      description: modal.querySelector('#gt-description').value.trim(),
      priority: modal.querySelector('#gt-priority').value,
      due_date: modal.querySelector('#gt-due').value || null,
      user_id: user?.id,
      assigned_to: modal.querySelector('#gt-assignee').value || user?.id
    });

    closeModal();
    showToast('Demanda criada! <span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span>', 'success');
    if (onSave) onSave();
  });
}

function priorityLabel(p) {
  const labels = { urgent: '<span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-danger); vertical-align: middle;">circle</span> Urgente', high: '<span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-warning); vertical-align: middle;">circle</span> Alta', medium: '<span class="material-symbols-outlined" style="font-size: inherit; color: #eab308; vertical-align: middle;">circle</span> Média', low: '<span class="material-symbols-outlined" style="font-size: inherit; color: var(--accent-success); vertical-align: middle;">circle</span> Baixa' };
  return labels[p] || p;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}
