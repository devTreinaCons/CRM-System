import { supabase } from '../supabase.js';

export async function renderAnalytics(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  try {
    const [
      { data: funnelData },
      { data: stages },
      { data: purchases },
      { data: contacts },
      { data: products },
      { data: history },
      { data: tasks }
    ] = await Promise.all([
      supabase.from('contact_funnel').select('*, funnels(name, products(name, icon, color)), funnel_stages:current_stage_id(name, position, color)'),
      supabase.from('funnel_stages').select('*, funnels(name, products(name))').order('position'),
      supabase.from('purchases').select('*, contacts(name), products(name, icon, color)').eq('status', 'completed'),
      supabase.from('contacts').select('id, name, birth_date'),
      supabase.from('products').select('*').eq('active', true),
      supabase.from('contact_funnel_history').select('*, contact_funnel(funnels(name, products(name)))'),
      supabase.from('tasks').select('status, priority')
    ]);

    // Compute stats
    const totalInFunnels = (funnelData || []).length;
    const wonDeals = (funnelData || []).filter(cf => cf.status === 'won').length;
    const lostDeals = (funnelData || []).filter(cf => cf.status === 'lost').length;
    const conversionRate = totalInFunnels > 0 ? ((wonDeals / totalInFunnels) * 100).toFixed(1) : 0;
    const totalRevenue = (purchases || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const avgTicket = purchases?.length > 0 ? totalRevenue / purchases.length : 0;

    // Group per funnel
    const funnelGroups = {};
    (funnelData || []).forEach(cf => {
      const fName = cf.funnels?.products?.name || cf.funnels?.name || 'Outro';
      if (!funnelGroups[fName]) funnelGroups[fName] = { stages: {}, total: 0, won: 0, lost: 0, icon: cf.funnels?.products?.icon || 'inventory_2', color: cf.funnels?.products?.color || '#6366f1' };
      funnelGroups[fName].total++;
      if (cf.status === 'won') funnelGroups[fName].won++;
      if (cf.status === 'lost') funnelGroups[fName].lost++;
      if (cf.funnel_stages) {
        const sName = cf.funnel_stages.name;
        if (!funnelGroups[fName].stages[sName]) funnelGroups[fName].stages[sName] = { count: 0, position: cf.funnel_stages.position, color: cf.funnel_stages.color };
        funnelGroups[fName].stages[sName].count++;
      }
    });

    // Products revenue
    const productRevenue = {};
    (purchases || []).forEach(p => {
      const pName = p.products?.name || 'Outro';
      if (!productRevenue[pName]) productRevenue[pName] = { revenue: 0, count: 0, icon: p.products?.icon || 'inventory_2', color: p.products?.color || '#6366f1' };
      productRevenue[pName].revenue += Number(p.amount);
      productRevenue[pName].count++;
    });

    // Cross-sell analysis
    const contactProducts = {};
    (purchases || []).forEach(p => {
      if (!contactProducts[p.contact_id]) contactProducts[p.contact_id] = new Set();
      contactProducts[p.contact_id].add(p.product_id);
    });

    const crossSellData = {};
    (products || []).forEach(p => {
      const notBought = Object.entries(contactProducts).filter(([_, prods]) => !prods.has(p.id)).length;
      crossSellData[p.name] = { notBought, icon: p.icon, total: Object.keys(contactProducts).length };
    });

    // Task stats
    const tasksByStatus = {};
    (tasks || []).forEach(t => {
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    });

    // Birthdays of the week
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const birthdaysThisWeek = (contacts || []).filter(c => {
      if (!c.birth_date) return false;
      const bDate = new Date(c.birth_date);
      const thisYearBDate = new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate());

      // Handle year wrap around if the week spans across years (though rare for a single week)
      // But actually, for birthday logic, we just check if month/day is within week range
      return thisYearBDate >= startOfWeek && thisYearBDate <= endOfWeek;
    }).sort((a, b) => {
      const dateA = new Date(a.birth_date);
      const dateB = new Date(b.birth_date);
      return dateA.getMonth() - dateB.getMonth() || dateA.getDate() - dateB.getDate();
    });

    container.innerHTML = `
      <div class="animate-in">
        <div class="page-header">
          <div>
            <h1>Analytics</h1>
            <p class="page-header-sub">Relatórios e insights do seu CRM</p>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card" style="--kpi-color: var(--gradient-primary)">
            <div class="kpi-icon"><span class="material-symbols-outlined" style="font-size: 32px;">bar_chart</span></div>
            <div class="kpi-value">${conversionRate}%</div>
            <div class="kpi-label">Taxa de Conversão</div>
          </div>
          <div class="kpi-card" style="--kpi-color: var(--gradient-success)">
            <div class="kpi-icon"><span class="material-symbols-outlined" style="font-size: 32px;">payments</span></div>
            <div class="kpi-value">R$ ${formatCurrency(totalRevenue)}</div>
            <div class="kpi-label">Receita Total</div>
          </div>
          <div class="kpi-card" style="--kpi-color: var(--gradient-warning)">
            <div class="kpi-icon"><span class="material-symbols-outlined" style="font-size: 32px;">track_changes</span></div>
            <div class="kpi-value">R$ ${formatCurrency(avgTicket)}</div>
            <div class="kpi-label">Ticket Médio</div>
          </div>
          <div class="kpi-card" style="--kpi-color: var(--gradient-danger)">
            <div class="kpi-icon"><span class="material-symbols-outlined" style="font-size: 32px;">emoji_events</span></div>
            <div class="kpi-value">${wonDeals} / ${totalInFunnels}</div>
            <div class="kpi-label">Deals Ganhos</div>
          </div>
        </div>

        <!-- Funnel Analysis -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
          ${Object.entries(funnelGroups).map(([name, data]) => `
            <div class="card">
              <div class="card-header">
                <h3 class="card-title"><span class="material-symbols-outlined" style="vertical-align: middle;">${data.icon}</span> ${name}</h3>
                <div>
                  <span class="badge badge-success">${data.won} ganhos</span>
                  <span class="badge badge-danger">${data.lost} perdidos</span>
                </div>
              </div>
              <div class="funnel-chart">
                ${Object.entries(data.stages).sort((a, b) => a[1].position - b[1].position).map(([stageName, stageData]) => `
                  <div class="funnel-bar-row">
                    <span class="funnel-bar-label">${stageName}</span>
                    <div class="funnel-bar-track">
                      <div class="funnel-bar-fill" style="width:${Math.max((stageData.count / data.total) * 100, 8)}%; background:${stageData.color}">${stageData.count}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-color)">
                <span style="font-size:var(--font-size-sm);color:var(--text-secondary)">Conversão: </span>
                <span style="font-weight:700;color:var(--accent-success)">${data.total > 0 ? ((data.won / data.total) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Revenue by Product -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">payments</span> Receita por Produto</h3>
            </div>
            ${Object.entries(productRevenue).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, data]) => {
      const maxRevenue = Math.max(...Object.values(productRevenue).map(d => d.revenue));
      return `
                <div style="margin-bottom:12px">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:var(--font-size-sm);font-weight:600;display:flex;align-items:center;gap:6px"><span class="material-symbols-outlined" style="font-size:18px">${data.icon}</span> ${name}</span>
                    <span style="font-weight:700;color:var(--accent-success);font-size:var(--font-size-sm)">R$ ${formatCurrency(data.revenue)}</span>
                  </div>
                  <div class="funnel-bar-track" style="height:12px">
                    <div class="funnel-bar-fill" style="width:${(data.revenue / maxRevenue) * 100}%;background:${data.color};height:12px;font-size:0"></div>
                  </div>
                  <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:4px">${data.count} venda(s)</div>
                </div>
              `;
    }).join('')}
            ${Object.keys(productRevenue).length === 0 ? '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">Nenhuma venda registrada</p>' : ''}
          </div>

          <!-- Cross-sell Opportunities -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">target</span> Oportunidades de Cross-sell</h3>
            </div>
            <p style="font-size:var(--font-size-sm);color:var(--text-muted);margin-bottom:14px">Clientes que compraram outros produtos mas não estes:</p>
            ${Object.entries(crossSellData).sort((a, b) => b[1].notBought - a[1].notBought).map(([name, data]) => `
              <div class="recommendation-card">
                <span class="recommendation-icon material-symbols-outlined">${data.icon}</span>
                <div class="recommendation-info">
                  <div class="recommendation-name">${name}</div>
                  <div class="recommendation-reason">${data.notBought} de ${data.total} clientes ainda não compraram</div>
                </div>
                <span class="badge badge-warning">${data.total > 0 ? ((data.notBought / data.total) * 100).toFixed(0) : 0}%</span>
              </div>
            `).join('')}
            ${Object.keys(crossSellData).length === 0 ? '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">Sem dados suficientes</p>' : ''}
          </div>
        </div>

        <!-- Task Analytics & Birthdays -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">assignment</span> Distribuição de Tarefas</h3>
            </div>
            <div class="stat-grid">
              <div class="stat-item">
                <div class="stat-value" style="color:var(--accent-warning)">${tasksByStatus['pending'] || 0}</div>
                <div class="stat-label"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">hourglass_empty</span> Pendentes</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color:var(--accent-info)">${tasksByStatus['in_progress'] || 0}</div>
                <div class="stat-label"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">sync</span> Em Andamento</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color:var(--accent-success)">${tasksByStatus['completed'] || 0}</div>
                <div class="stat-label"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">check_circle</span> Concluídas</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color:var(--text-muted)">${tasksByStatus['cancelled'] || 0}</div>
                <div class="stat-label"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">close</span> Canceladas</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">cake</span> Aniversariantes da Semana</h3>
            </div>
            <div style="max-height: 200px; overflow-y: auto;">
              ${birthdaysThisWeek.length === 0 ? '<p style="color:var(--text-muted);font-size:var(--font-size-sm);padding:20px;text-align:center">Ninguém faz aniversário esta semana</p>' :
        birthdaysThisWeek.map(c => {
          const bDate = new Date(c.birth_date);
          const isToday = bDate.getDate() === today.getDate() && bDate.getMonth() === today.getMonth();
          return `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-bottom:1px solid var(--border-color); cursor:pointer" onclick="window.location.hash='#/contacts/${c.id}'">
                    <div style="display:flex;align-items:center;gap:10px">
                      <div class="avatar avatar-xs" style="background:var(--accent-primary); font-size:10px">${c.name.substring(0, 2).toUpperCase()}</div>
                      <div>
                        <div style="font-weight:600;font-size:var(--font-size-sm)">${c.name}</div>
                        <div style="font-size:10px;color:var(--text-muted)">${bDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</div>
                      </div>
                    </div>
                    ${isToday ? '<span class="badge badge-success" style="font-size:10px animation: pulse 2s infinite">HOJE! 🎂</span>' : ''}
                  </div>
                `;
        }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

  } catch (error) {
    console.error('Analytics error:', error);
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><span class="material-symbols-outlined" style="font-size: inherit; vertical-align: middle;">close</span></div><div class="empty-state-text">${error.message}</div></div>`;
  }
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
