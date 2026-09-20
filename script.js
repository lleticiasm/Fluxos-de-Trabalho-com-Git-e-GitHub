(function(){
  const STORAGE_KEY = 'bolosDaMaria_estoque_v1';
  let produtos = [];
  let editingId = null;

  function loadProdutos(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      produtos = raw ? JSON.parse(raw) : [];
    }catch(e){
      console.error('Erro ao carregar estoque salvo:', e);
      produtos = [];
    }
  }

  function saveProdutos(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(produtos));
    }catch(e){
      console.error('Erro ao salvar estoque:', e);
      showFormMsg('Não foi possível salvar. Verifique o armazenamento do navegador.', 'error');
    }
  }

  function uid(){
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  function isLow(p){
    return p.estoqueMinimo != null && p.estoqueMinimo !== '' && Number(p.quantidade) <= Number(p.estoqueMinimo);
  }

  function fmtQty(p){
    const q = Number(p.quantidade);
    const qStr = Number.isInteger(q) ? q.toString() : q.toFixed(2);
    return qStr + ' ' + p.unidade;
  }

  function fmtDate(iso){
    if(!iso) return '—';
    const [y,m,d] = iso.split('-');
    return d + '/' + m + '/' + y;
  }

  // ---- form ----
  const form = document.getElementById('productForm');
  const nomeEl = document.getElementById('nome');
  const categoriaEl = document.getElementById('categoria');
  const quantidadeEl = document.getElementById('quantidade');
  const unidadeEl = document.getElementById('unidade');
  const estoqueMinimoEl = document.getElementById('estoqueMinimo');
  const fornecedorEl = document.getElementById('fornecedor');
  const validadeEl = document.getElementById('validade');
  const submitBtn = document.getElementById('submitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const formTitle = document.getElementById('formTitle');
  const formMsg = document.getElementById('formMsg');

  function showFormMsg(text, type){
    formMsg.textContent = text;
    formMsg.className = 'form-msg' + (type ? ' ' + type : '');
    if(text){
      setTimeout(() => { if(formMsg.textContent === text){ formMsg.textContent=''; formMsg.className='form-msg'; } }, 3500);
    }
  }

  function resetForm(){
    form.reset();
    editingId = null;
    submitBtn.textContent = 'Adicionar ao estoque';
    formTitle.textContent = 'Novo produto';
    cancelEditBtn.style.display = 'none';
  }

  function startEdit(id){
    const p = produtos.find(x => x.id === id);
    if(!p) return;
    editingId = id;
    nomeEl.value = p.nome;
    categoriaEl.value = p.categoria;
    quantidadeEl.value = p.quantidade;
    unidadeEl.value = p.unidade;
    estoqueMinimoEl.value = p.estoqueMinimo ?? '';
    fornecedorEl.value = p.fornecedor || '';
    validadeEl.value = p.validade || '';
    submitBtn.textContent = 'Salvar alterações';
    formTitle.textContent = 'Editar produto';
    cancelEditBtn.style.display = 'block';
    nomeEl.focus();
  }

  cancelEditBtn.addEventListener('click', () => {
    resetForm();
    showFormMsg('');
  });

  form.addEventListener('submit', function(e){
    e.preventDefault();

    const nome = nomeEl.value.trim();
    const categoria = categoriaEl.value;
    const quantidade = parseFloat(quantidadeEl.value);
    const unidade = unidadeEl.value;
    const estoqueMinimoRaw = estoqueMinimoEl.value;
    const estoqueMinimo = estoqueMinimoRaw === '' ? null : parseFloat(estoqueMinimoRaw);
    const fornecedor = fornecedorEl.value.trim();
    const validade = validadeEl.value;

    if(!nome){ showFormMsg('Informe o nome do produto.', 'error'); nomeEl.focus(); return; }
    if(!categoria){ showFormMsg('Selecione uma categoria.', 'error'); categoriaEl.focus(); return; }
    if(isNaN(quantidade) || quantidade < 0){ showFormMsg('Informe uma quantidade válida.', 'error'); quantidadeEl.focus(); return; }
    if(estoqueMinimo !== null && (isNaN(estoqueMinimo) || estoqueMinimo < 0)){ showFormMsg('Estoque mínimo inválido.', 'error'); estoqueMinimoEl.focus(); return; }

    if(editingId){
      const p = produtos.find(x => x.id === editingId);
      Object.assign(p, { nome, categoria, quantidade, unidade, estoqueMinimo, fornecedor, validade });
      showFormMsg('Produto atualizado.', 'success');
    }else{
      produtos.push({ id: uid(), nome, categoria, quantidade, unidade, estoqueMinimo, fornecedor, validade, criadoEm: new Date().toISOString() });
      showFormMsg('Produto adicionado ao estoque.', 'success');
    }

    saveProdutos();
    resetForm();
    populateCategoryFilter();
    render();
  });

  // ---- filters ----
  const searchInput = document.getElementById('searchInput');
  const filterCategoria = document.getElementById('filterCategoria');
  const filterStatus = document.getElementById('filterStatus');

  [searchInput, filterCategoria, filterStatus].forEach(el => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  function populateCategoryFilter(){
    const current = filterCategoria.value;
    const cats = Array.from(new Set(produtos.map(p => p.categoria))).sort();
    filterCategoria.innerHTML = '<option value="">Todas as categorias</option>' +
      cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if(cats.includes(current)) filterCategoria.value = current;
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  // ---- render ----
  const tableWrap = document.getElementById('tableWrap');
  const summaryRow = document.getElementById('summaryRow');

  function getFiltered(){
    const q = searchInput.value.trim().toLowerCase();
    const cat = filterCategoria.value;
    const status = filterStatus.value;

    return produtos.filter(p => {
      if(cat && p.categoria !== cat) return false;
      if(status === 'ok' && isLow(p)) return false;
      if(status === 'low' && !isLow(p)) return false;
      if(q){
        const hay = (p.nome + ' ' + (p.fornecedor||'')).toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function render(){
    const list = getFiltered();
    const lowCount = produtos.filter(isLow).length;

    summaryRow.innerHTML = `<span><strong>${produtos.length}</strong> ${produtos.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}</span>` +
      (lowCount > 0 ? ` <span class="alert">&middot; ${lowCount} com estoque baixo</span>` : '');

    if(list.length === 0){
      tableWrap.innerHTML = produtos.length === 0
        ? `<div class="empty-state"><strong>Nenhum produto cadastrado ainda</strong>Use o formulário ao lado para adicionar a primeira matéria-prima do estoque.</div>`
        : `<div class="empty-state"><strong>Nada encontrado</strong>Ajuste a busca ou os filtros para ver outros produtos.</div>`;
      return;
    }

    const rows = list.map(p => {
      const low = isLow(p);
      return `
        <tr class="${low ? 'low-stock' : ''}">
          <td>
            <div class="prod-name">${escapeHtml(p.nome)}</div>
            <div class="prod-cat">${escapeHtml(p.categoria)}</div>
          </td>
          <td>${escapeHtml(fmtQty(p))}</td>
          <td>${p.estoqueMinimo != null ? escapeHtml(String(p.estoqueMinimo)) + ' ' + escapeHtml(p.unidade) : '—'}</td>
          <td><span class="badge ${low ? 'low' : 'ok'}">${low ? 'Estoque baixo' : 'OK'}</span></td>
          <td>${p.fornecedor ? escapeHtml(p.fornecedor) : '—'}</td>
          <td>${fmtDate(p.validade)}</td>
          <td>
            <div class="row-actions">
              <button class="edit" data-id="${p.id}">Editar</button>
              <button class="del" data-id="${p.id}">Excluir</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Quantidade</th>
            <th>Mínimo</th>
            <th>Status</th>
            <th>Fornecedor</th>
            <th>Validade</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    tableWrap.querySelectorAll('button.edit').forEach(btn => {
      btn.addEventListener('click', () => startEdit(btn.dataset.id));
    });
    tableWrap.querySelectorAll('button.del').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = produtos.find(x => x.id === btn.dataset.id);
        if(p && confirm(`Excluir "${p.nome}" do estoque?`)){
          produtos = produtos.filter(x => x.id !== btn.dataset.id);
          saveProdutos();
          populateCategoryFilter();
          render();
        }
      });
    });
  }

  // ---- init ----
  loadProdutos();
  populateCategoryFilter();
  render();
})();
