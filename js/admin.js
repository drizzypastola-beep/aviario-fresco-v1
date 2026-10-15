import {
  db, collection, doc, updateDoc, deleteDoc, addDoc,
  onSnapshot, serverTimestamp, setDoc, getDoc
} from "./firebase.js";
import { ZONAS_PADRAO } from "./config.js";

const SENHA = "Pastola13";

let senhaZerar = "zerar2025"; // será carregada do Firebase
let dataZeramento = null;     // data a partir da qual conta a receita

window.fazerLogin = () => {
  const s = document.getElementById('senhaAdmin').value;
  if (s === SENHA) {
    sessionStorage.setItem('adminLogado', '1');
    abrirPainel();
  } else {
    alert('Senha errada');
  }
};

function abrirPainel() {
  document.getElementById('loginTela').style.display = 'none';
  document.getElementById('adminTela').style.display = 'block';
  iniciarListeners();
}

window.logout = () => {
  sessionStorage.removeItem('adminLogado');
  location.reload();
};

if (sessionStorage.getItem('adminLogado') === '1') abrirPainel();

let produtos = [];
let midia = [];
let encomendas = [];
let zonas = [];
let videoDestaqueUrl = '';
let filtroEncomendas = 'ativas';

function iniciarListeners() {
  onSnapshot(collection(db, 'produtos'), snap => {
    produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProdutos(); renderStock(); renderDashboard();
  });
  onSnapshot(collection(db, 'galeria'), snap => {
    midia = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGaleria();
  });
  onSnapshot(collection(db, 'encomendas'), snap => {
    encomendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEncomendas(); renderDashboard();
  });
  onSnapshot(doc(db, 'config', 'site'), snap => {
    if (snap.exists()) videoDestaqueUrl = snap.data().videoDestaqueUrl || '';
  });
  onSnapshot(doc(db, 'config', 'zonas'), snap => {
    if (snap.exists() && snap.data().lista) {
      zonas = snap.data().lista;
    } else {
      zonas = ZONAS_PADRAO;
    }
    renderZonas();
  });
  onSnapshot(doc(db, 'config', 'receita'), snap => {
    if (snap.exists()) {
      const dados = snap.data();
      if (dados.senhaZerar) senhaZerar = dados.senhaZerar;
      if (dados.dataZeramento) {
        dataZeramento = dados.dataZeramento.toDate ? dados.dataZeramento.toDate() : null;
      }
    }
    renderDashboard();
  });
}

window.adminTab = (tab, btn) => {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  ['dashboard','produtos','stock','encomendas','zonas','galeria','seguranca'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'seguranca') renderSeguranca();
};

// ============ DASHBOARD ============
function renderDashboard() {
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  const entreguesFiltradas = encomendas.filter(e => {
    if (e.estado !== 'entregue') return false;
    const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
    if (!d) return false;
    // Se há data de zeramento, só conta a partir dela
    if (dataZeramento && d < dataZeramento) return false;
    return true;
  });

  const receitaTotal = entreguesFiltradas.reduce((s, e) => s + (e.total || 0), 0);

  const receitaHoje = entreguesFiltradas.filter(e => {
    const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
    return d && d >= inicioHoje;
  }).reduce((s, e) => s + (e.total || 0), 0);

  const ha7dias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const receitaSemana = entreguesFiltradas.filter(e => {
    const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
    return d && d >= ha7dias;
  }).reduce((s, e) => s + (e.total || 0), 0);

  const ha30dias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const entreguesMes = entreguesFiltradas.filter(e => {
    const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
    return d && d >= ha30dias;
  });
  const receitaMes = entreguesMes.reduce((s, e) => s + (e.total || 0), 0);

  // Ticket médio
  const ticketMedio = entreguesFiltradas.length > 0
    ? Math.round(receitaTotal / entreguesFiltradas.length)
    : 0;

  // Produto mais vendido (por quantidade)
  const contagemProdutos = {};
  entreguesFiltradas.forEach(e => {
    (e.itens || []).forEach(i => {
      const chave = i.nome;
      contagemProdutos[chave] = (contagemProdutos[chave] || 0) + (i.qtd || 0);
    });
  });
  const produtoTop = Object.entries(contagemProdutos).sort((a, b) => b[1] - a[1])[0];

  // Ativas e hoje
  const ativas = encomendas.filter(e => {
    const est = e.estado || 'nova';
    return est !== 'entregue' && est !== 'cancelada';
  }).length;

  const hoje = new Date().toDateString();
  const encomendasHoje = encomendas.filter(e => {
    const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
    return d && d.toDateString() === hoje;
  }).length;

  document.getElementById('tab-dashboard').innerHTML = `
    <div class="resumo-dashboard">
      <div class="resumo-card"><h4>📅 Receita Hoje</h4><div class="valor">${receitaHoje} MZN</div></div>
      <div class="resumo-card"><h4>📅 Receita Semana</h4><div class="valor">${receitaSemana} MZN</div></div>
      <div class="resumo-card"><h4>📅 Receita Mês</h4><div class="valor">${receitaMes} MZN</div></div>
      <div class="resumo-card"><h4>💰 Receita Total</h4><div class="valor">${receitaTotal} MZN</div></div>
    </div>

    <div class="resumo-dashboard">
      <div class="resumo-card"><h4>🛒 Encomendas hoje</h4><div class="valor">${encomendasHoje}</div></div>
      <div class="resumo-card"><h4>🟢 Ativas</h4><div class="valor">${ativas}</div></div>
      <div class="resumo-card"><h4>🎟️ Ticket médio</h4><div class="valor">${ticketMedio} MZN</div></div>
      <div class="resumo-card"><h4>🏆 Top produto</h4><div class="valor" style="font-size:16px;">${produtoTop ? produtoTop[0] : '—'}</div></div>
    </div>

    ${dataZeramento ? `
      <div class="card-admin" style="background:#fff8e7;border-left:4px solid #f4a300;">
        <strong>ℹ️ Receita a contar desde:</strong>
        ${dataZeramento.toLocaleDateString('pt-MZ')}
        <div style="font-size:12px;color:#666;margin-top:4px;">
          Encomendas anteriores a esta data não são contadas.
        </div>
      </div>
    ` : ''}

    <div class="card-admin">
      <button class="btn-perigo" style="width:100%;padding:12px;background:#c62828;color:white;font-size:14px;" onclick="pedirSenhaZerar()">
        🗑️ Zerar Receita Total
      </button>
      <div style="font-size:12px;color:#666;margin-top:8px;text-align:center;">
        As encomendas não são apagadas — só deixam de contar para a receita.
      </div>
    </div>
  `;
}

// ============ SEGURANÇA ============
function renderSeguranca() {
  document.getElementById('tab-seguranca').innerHTML = `
    <div class="card-admin">
      <h3>🔐 Alterar senha de zerar receita</h3>
      <p style="font-size:13px;color:#666;margin-bottom:12px;">
        Esta senha é usada quando queres zerar a receita total.
      </p>
      <div class="form-linha full">
        <div>
          <label>Senha atual</label>
          <input type="password" id="seg_senha_atual" placeholder="Senha atual">
        </div>
      </div>
      <div class="form-linha full">
        <div>
          <label>Nova senha</label>
          <input type="password" id="seg_senha_nova" placeholder="Nova senha">
        </div>
      </div>
      <div class="form-linha full">
        <div>
          <label>Confirmar nova senha</label>
          <input type="password" id="seg_senha_confirma" placeholder="Repetir nova senha">
        </div>
      </div>
      <button class="btn-primario" onclick="alterarSenhaZerar()">💾 Alterar senha</button>
    </div>

    <div class="card-admin">
      <h3>ℹ️ Informação</h3>
      <p style="font-size:13px;color:#666;line-height:1.7;">
        • A senha de <strong>entrar no admin</strong> é <code>aviario2025</code> (fixa no código)<br>
        • A senha de <strong>zerar receita</strong> está guardada no Firebase e pode ser alterada aqui<br>
        • Se esqueceres a senha de zerar, terás de a apagar do Firebase manualmente
      </p>
    </div>
  `;
}

window.alterarSenhaZerar = async () => {
  const atual = document.getElementById('seg_senha_atual').value.trim();
  const nova = document.getElementById('seg_senha_nova').value.trim();
  const conf = document.getElementById('seg_senha_confirma').value.trim();

  if (atual !== senhaZerar) { alert('❌ Senha atual errada'); return; }
  if (!nova || nova.length < 4) { alert('❌ Nova senha tem de ter pelo menos 4 caracteres'); return; }
  if (nova !== conf) { alert('❌ As senhas novas não coincidem'); return; }

  await setDoc(doc(db, 'config', 'receita'), { senhaZerar: nova }, { merge: true });
  senhaZerar = nova;
  alert('✅ Senha alterada com sucesso!');
  renderSeguranca();
};

window.pedirSenhaZerar = () => {
  const senha = prompt(
    '🔐 Para zerar a receita total, insere a senha de zeramento:\n\n' +
    '(As encomendas NÃO são apagadas — apenas deixam de contar para a receita.)'
  );
  if (senha === null) return;

  if (senha !== senhaZerar) {
    alert('❌ Senha errada');
    return;
  }

  const confirmar = confirm(
    '⚠️ Tens a certeza?\n\n' +
    'A receita total vai passar a contar apenas a partir de AGORA.\n' +
    'As encomendas anteriores continuam guardadas, mas não contam para a receita.'
  );
  if (!confirmar) return;

  zerarReceita();
};

async function zerarReceita() {
  await setDoc(doc(db, 'config', 'receita'), {
    senhaZerar: senhaZerar,
    dataZeramento: serverTimestamp()
  }, { merge: true });
  alert('✅ Receita zerada! Passa a contar a partir de agora.');
}

// ============ PRODUTOS ============
function renderProdutos() {
  let html = `
    <div class="card-admin">
      <h3>➕ Adicionar produto</h3>
      <div class="form-linha">
        <div><label>Nome</label><input id="np_nome"></div>
        <div><label>Categoria</label>
          <select id="np_cat">
            <option value="frango">🐔 Frango</option>
            <option value="ovo">🥚 Ovo</option>
            <option value="pato">🦆 Pato</option>
          </select>
        </div>
      </div>
      <div class="form-linha">
        <div><label>Preço/kg (MZN)</label><input type="number" id="np_precokg"></div>
        <div><label>Preço/unidade (MZN)</label><input type="number" id="np_precoun"></div>
      </div>
      <div class="form-linha">
        <div><label>Peso médio (kg)</label><input type="number" id="np_peso" step="0.1"></div>
        <div><label>Stock</label><input type="number" id="np_stock"></div>
      </div>
      <div class="form-linha full"><div><label>Descrição</label><input id="np_desc"></div></div>
      <div class="form-linha full">
        <div>
          <label>Link da imagem</label>
          <input id="np_img" placeholder="https://drive.google.com/file/d/...">
        </div>
      </div>
      <div class="form-linha full">
        <label><input type="checkbox" id="np_sounidade" style="width:auto;"> Vender só por unidade</label>
      </div>
      <button class="btn-primario" onclick="adicionarProduto()">➕ Adicionar</button>
    </div>
    <h3 style="margin:16px 0 10px;">📦 Produtos (${produtos.length})</h3>
  `;
  produtos.forEach(p => {
    const preco = p.soUnidade ? `${p.precoUn} MZN/un` : `${p.precoKg}/kg · ${p.precoUn}/un`;
    html += `
      <div class="lista-admin-item">
        <div class="info"><strong>${p.nome}</strong><small>${preco} · Stock: ${p.stock}</small></div>
        <button class="btn-perigo" onclick="removerProduto('${p.id}')">🗑️</button>
      </div>
    `;
  });
  document.getElementById('tab-produtos').innerHTML = html;
}

window.adicionarProduto = async () => {
  const nome = document.getElementById('np_nome').value.trim();
  if (!nome) { alert('Nome obrigatório'); return; }
  const imgInput = document.getElementById('np_img').value.trim();
  let imgFinal = '';
  if (imgInput) {
    imgFinal = converterLink(imgInput, 'foto');
    if (imgFinal === null) return;
  }
  await addDoc(collection(db, 'produtos'), {
    nome,
    cat: document.getElementById('np_cat').value,
    desc: document.getElementById('np_desc').value || '',
    precoKg: parseFloat(document.getElementById('np_precokg').value) || 0,
    precoUn: parseFloat(document.getElementById('np_precoun').value) || 0,
    pesoMedio: parseFloat(document.getElementById('np_peso').value) || 1,
    stock: parseInt(document.getElementById('np_stock').value) || 0,
    img: imgFinal,
    soUnidade: document.getElementById('np_sounidade').checked
  });
  ['np_nome','np_precokg','np_precoun','np_peso','np_stock','np_desc','np_img'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('np_sounidade').checked = false;
  alert('✅ Adicionado!');
};

window.removerProduto = async (id) => {
  if (!confirm('Remover?')) return;
  await deleteDoc(doc(db, 'produtos', id));
};

// ============ STOCK ============
function renderStock() {
  let html = '<h3 style="margin-bottom:10px;">📈 Atualizar stock</h3>';
  produtos.forEach(p => {
    html += `
      <div class="lista-admin-item">
        <div class="info"><strong>${p.nome}</strong><small>Atual: ${p.stock}</small></div>
        <input type="number" value="${p.stock}" min="0"
               style="width:80px;padding:6px;border:1px solid #ddd;border-radius:8px;text-align:center;"
               onchange="atualizarStock('${p.id}', this.value)">
      </div>
    `;
  });
  document.getElementById('tab-stock').innerHTML = html;
}

window.atualizarStock = async (id, valor) => {
  await updateDoc(doc(db, 'produtos', id), { stock: parseInt(valor) || 0 });
};

// ============ ENCOMENDAS ============
window.mudarFiltroEncomendas = (filtro, btn) => {
  filtroEncomendas = filtro;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
  if (btn) btn.classList.add('ativo');
  renderEncomendas();
};

function getFiltroAtivo() {
  const agora = new Date();
  const encomendasOrdenadas = [...encomendas].sort((a, b) => {
    const da = a.criadaEm?.toDate ? a.criadaEm.toDate() : 0;
    const dbb = b.criadaEm?.toDate ? b.criadaEm.toDate() : 0;
    return dbb - da;
  });

  if (filtroEncomendas === 'todas') return encomendasOrdenadas;

  if (filtroEncomendas === 'ativas') {
    return encomendasOrdenadas.filter(e => {
      const est = e.estado || 'nova';
      return est !== 'entregue' && est !== 'cancelada';
    });
  }

  if (filtroEncomendas === 'canceladas') {
    return encomendasOrdenadas.filter(e => e.estado === 'cancelada');
  }

  if (filtroEncomendas === 'entregues') {
    return encomendasOrdenadas.filter(e => e.estado === 'entregue');
  }

  const limites = { 'hoje': 1, 'semana': 7, 'mes': 30, 'mes3': 90, 'mes6': 180, 'ano': 365 };

  if (filtroEncomendas === 'antigas') {
    return encomendasOrdenadas.filter(e => {
      const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
      if (!d) return false;
      return (agora - d) / (1000 * 60 * 60 * 24) > 365;
    });
  }

  const dias = limites[filtroEncomendas];
  if (dias) {
    return encomendasOrdenadas.filter(e => {
      const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
      if (!d) return false;
      return (agora - d) / (1000 * 60 * 60 * 24) <= dias;
    });
  }

  return encomendasOrdenadas;
}

function renderEncomendas() {
  const agora = new Date();
  const ativas = encomendas.filter(e => {
    const est = e.estado || 'nova';
    return est !== 'entregue' && est !== 'cancelada';
  }).length;
  const canceladas = encomendas.filter(e => e.estado === 'cancelada').length;
  const entregues = encomendas.filter(e => e.estado === 'entregue').length;

  const hoje = new Date().toDateString();
  const contaHoje = encomendas.filter(e => {
    const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
    return d && d.toDateString() === hoje;
  }).length;

  const canceladasAntigas = encomendas.filter(e => {
    if (e.estado !== 'cancelada') return false;
    const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
    if (!d) return false;
    return (agora - d) / (1000 * 60 * 60 * 24) > 30;
  });

  let html = `
    <div class="card-admin">
      <h3>🛒 Encomendas</h3>
      <div class="filtros-encomendas" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
        <button class="filtro-btn ${filtroEncomendas === 'ativas' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('ativas', this)">🟢 Ativas (${ativas})</button>
        <button class="filtro-btn ${filtroEncomendas === 'hoje' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('hoje', this)">📅 Hoje (${contaHoje})</button>
        <button class="filtro-btn ${filtroEncomendas === 'semana' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('semana', this)">📅 Semana</button>
        <button class="filtro-btn ${filtroEncomendas === 'mes' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('mes', this)">📅 Mês</button>
        <button class="filtro-btn ${filtroEncomendas === 'mes6' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('mes6', this)">📅 6 Meses</button>
        <button class="filtro-btn ${filtroEncomendas === 'antigas' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('antigas', this)">📚 +1 Ano</button>
        <button class="filtro-btn ${filtroEncomendas === 'entregues' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('entregues', this)">✅ Entregues (${entregues})</button>
        <button class="filtro-btn ${filtroEncomendas === 'canceladas' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('canceladas', this)">❌ Canceladas (${canceladas})</button>
        <button class="filtro-btn ${filtroEncomendas === 'todas' ? 'ativo' : ''}" onclick="mudarFiltroEncomendas('todas', this)">📋 Todas</button>
      </div>
      ${filtroEncomendas === 'canceladas' && canceladasAntigas.length > 0 ? `
        <button class="btn-perigo" style="width:100%;padding:12px;margin-bottom:12px;" onclick="limparCanceladasAntigas()">
          🗑️ Limpar canceladas com mais de 1 mês (${canceladasAntigas.length})
        </button>
      ` : ''}
    </div>
  `;

  const filtradas = getFiltroAtivo();
  if (filtradas.length === 0) html += '<p style="text-align:center;color:#999;padding:20px;">Nenhuma encomenda neste filtro.</p>';

  filtradas.forEach(e => {
    const estado = e.estado || 'nova';
    const data = e.criadaEm?.toDate ? e.criadaEm.toDate().toLocaleString('pt-MZ') : '—';
    html += `
      <div class="card-admin">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <strong>${e.cliente}</strong>
          <span class="badge-estado estado-${estado}">${traduzEstado(estado)}</span>
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">📞 ${e.telefone} · ${data}</div>
        <div style="font-size:13px;margin-bottom:8px;">
          ${(e.itens||[]).map(i => `• ${i.nome} (${i.tipo === 'kg' ? i.qtd + 'kg' : i.qtd + 'un'})`).join('<br>')}
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">
          Subtotal: ${e.subtotal || e.total} MZN
          ${e.taxaEntrega ? `+ Entrega: ${e.taxaEntrega} MZN` : ''}
        </div>
        <div style="font-weight:bold;color:#e07b00;margin-bottom:8px;">TOTAL: ${e.total} MZN</div>
        <div style="font-size:12px;color:#666;margin-bottom:10px;">
          ${e.tipoEntrega === 'entrega' ? '🚚 ' + (e.zona || '') + ' — ' + (e.endereco || '') : '🏠 Retirada'}
          ${e.pagamento ? '<br>💳 ' + e.pagamento : ''}
          ${e.dataDesejada ? '<br>📅 ' + e.dataDesejada : ''}
          ${e.observacoes ? '<br>📝 ' + e.observacoes : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn-editar" onclick="mudarEstado('${e.id}','confirmada')">✅ Confirmar</button>
          <button class="btn-editar" onclick="mudarEstado('${e.id}','preparacao')">👨‍🍳 Preparar</button>
          <button class="btn-editar" onclick="mudarEstado('${e.id}','pronta')">📦 Pronta</button>
          <button class="btn-editar" onclick="mudarEstado('${e.id}','caminho')">🚚 A caminho</button>
          <button class="btn-editar" onclick="mudarEstado('${e.id}','entregue')">🎉 Entregue</button>
          <button class="btn-perigo" onclick="mudarEstado('${e.id}','cancelada')">❌ Cancelar</button>
          <a class="btn-editar" style="text-decoration:none;" target="_blank"
             href="https://wa.me/${(e.telefone||'').replace(/\\D/g,'')}">💬 WhatsApp</a>
        </div>
      </div>
    `;
  });
  document.getElementById('tab-encomendas').innerHTML = html;
}

window.limparCanceladasAntigas = async () => {
  const agora = new Date();
  const antigas = encomendas.filter(e => {
    if (e.estado !== 'cancelada') return false;
    const d = e.criadaEm?.toDate ? e.criadaEm.toDate() : null;
    if (!d) return false;
    return (agora - d) / (1000 * 60 * 60 * 24) > 30;
  });

  if (antigas.length === 0) { alert('Não há canceladas antigas.'); return; }
  if (!confirm(`Remover ${antigas.length} encomenda(s) cancelada(s) com mais de 1 mês?`)) return;

  for (const enc of antigas) {
    await deleteDoc(doc(db, 'encomendas', enc.id));
  }
  alert(`✅ ${antigas.length} encomenda(s) removida(s).`);
};

function traduzEstado(estado) {
  const map = {
    'nova': '🆕 NOVA',
    'confirmada': '✅ CONFIRMADA',
    'preparacao': '👨‍🍳 EM PREPARAÇÃO',
    'pronta': '📦 PRONTA',
    'caminho': '🚚 A CAMINHO',
    'entregue': '🎉 ENTREGUE',
    'cancelada': '❌ CANCELADA'
  };
  return map[estado] || estado.toUpperCase();
}

window.mudarEstado = async (id, estado) => {
  await updateDoc(doc(db, 'encomendas', id), { estado });
};

// ============ ZONAS ============
function renderZonas() {
  let html = `
    <div class="card-admin">
      <h3>🚚 Gerir zonas e taxas de entrega</h3>
      <div class="form-linha">
        <div><label>Nome da zona</label><input id="nz_nome" placeholder="Ex.: Machava"></div>
        <div><label>Taxa de entrega (MZN)</label><input type="number" id="nz_taxa" placeholder="Ex.: 80"></div>
      </div>
      <button class="btn-primario" onclick="adicionarZona()">➕ Adicionar zona</button>
    </div>
    <h3 style="margin:16px 0 10px;">📋 Zonas configuradas (${zonas.length})</h3>
  `;
  zonas.forEach(z => {
    html += `
      <div class="lista-admin-item">
        <div class="info"><strong>${z.nome}</strong><small>Taxa: ${z.taxa} MZN</small></div>
        <input type="number" value="${z.taxa}" min="0"
               style="width:80px;padding:6px;border:1px solid #ddd;border-radius:8px;text-align:center;"
               onchange="atualizarTaxaZona('${z.id}', this.value)">
        <button class="btn-perigo" onclick="removerZona('${z.id}')">🗑️</button>
      </div>
    `;
  });
  document.getElementById('tab-zonas').innerHTML = html;
}

window.adicionarZona = async () => {
  const nome = document.getElementById('nz_nome').value.trim();
  const taxa = parseFloat(document.getElementById('nz_taxa').value) || 0;
  if (!nome) { alert('Nome obrigatório'); return; }
  zonas.push({ id: 'zona-' + Date.now(), nome, taxa });
  await setDoc(doc(db, 'config', 'zonas'), { lista: zonas });
  document.getElementById('nz_nome').value = '';
  document.getElementById('nz_taxa').value = '';
  alert('✅ Zona adicionada!');
};

window.atualizarTaxaZona = async (id, valor) => {
  const zona = zonas.find(z => z.id === id);
  if (!zona) return;
  zona.taxa = parseFloat(valor) || 0;
  await setDoc(doc(db, 'config', 'zonas'), { lista: zonas });
};

window.removerZona = async (id) => {
  if (!confirm('Remover esta zona?')) return;
  zonas = zonas.filter(z => z.id !== id);
  await setDoc(doc(db, 'config', 'zonas'), { lista: zonas });
};

// ============ GALERIA ============
function renderGaleria() {
  let html = `
    <div class="card-admin">
      <h3>🎬 Vídeo destaque</h3>
      <div class="form-linha full"><div>
        <label>Link YouTube, Vimeo ou Google Drive</label>
        <input id="ag_video" value="${videoDestaqueUrl}" placeholder="https://drive.google.com/file/d/...">
      </div></div>
      <button class="btn-primario" onclick="salvarVideo()">💾 Salvar</button>
    </div>
    <div class="card-admin">
      <h3>📷 Adicionar foto</h3>
      <div class="form-linha full"><div>
        <label>Link da imagem</label>
        <input id="ag_foto_url" placeholder="https://drive.google.com/file/d/...">
      </div></div>
      <div class="form-linha full"><div>
        <label>Título (opcional)</label>
        <input id="ag_foto_titulo">
      </div></div>
      <button class="btn-primario" onclick="adicionarFoto()">📤 Adicionar foto</button>
    </div>
    <div class="card-admin">
      <h3>🎥 Adicionar vídeo</h3>
      <div class="form-linha full"><div>
        <label>Link YouTube, Vimeo ou Google Drive</label>
        <input id="ag_video_url" placeholder="https://drive.google.com/file/d/...">
      </div></div>
      <div class="form-linha full"><div>
        <label>Título (opcional)</label>
        <input id="ag_video_titulo">
      </div></div>
      <button class="btn-primario" onclick="adicionarVideo()">➕ Adicionar vídeo</button>
    </div>
    <h3 style="margin:16px 0 10px;">🎥 Mídia (${midia.length})</h3>
  `;
  midia.forEach(m => {
    html += `
      <div class="lista-admin-item">
        <div class="info">
          <strong>${m.tipo === 'foto' ? '📷' : '🎥'} ${m.titulo || 'Sem título'}</strong>
          <small>${(m.url || '').slice(0, 50)}...</small>
        </div>
        <button class="btn-perigo" onclick="removerMidia('${m.id}')">🗑️</button>
      </div>
    `;
  });
  document.getElementById('tab-galeria').innerHTML = html;
}

window.salvarVideo = async () => {
  const url = document.getElementById('ag_video').value.trim();
  if (!url) { alert('Cola o link do vídeo'); return; }
  const urlConvertida = converterLink(url, 'video');
  if (urlConvertida === null) return;
  await setDoc(doc(db, 'config', 'site'), { videoDestaqueUrl: urlConvertida }, { merge: true });
  videoDestaqueUrl = urlConvertida;
  alert('✅ Salvo!');
};

window.adicionarFoto = async () => {
  const url = document.getElementById('ag_foto_url').value.trim();
  if (!url) { alert('Cola o link da imagem'); return; }
  const urlConvertida = converterLink(url, 'foto');
  if (urlConvertida === null) return;
  const titulo = document.getElementById('ag_foto_titulo').value.trim();
  await addDoc(collection(db, 'galeria'), {
    tipo: 'foto', url: urlConvertida, titulo: titulo || 'Foto', criadaEm: serverTimestamp()
  });
  document.getElementById('ag_foto_url').value = '';
  document.getElementById('ag_foto_titulo').value = '';
  alert('✅ Foto adicionada!');
};

window.adicionarVideo = async () => {
  const url = document.getElementById('ag_video_url').value.trim();
  if (!url) { alert('Cola o link do vídeo'); return; }
  const urlConvertida = converterLink(url, 'video');
  if (urlConvertida === null) return;
  const titulo = document.getElementById('ag_video_titulo').value.trim();
  await addDoc(collection(db, 'galeria'), {
    tipo: 'video', url: urlConvertida, titulo: titulo || 'Vídeo', criadaEm: serverTimestamp()
  });
  document.getElementById('ag_video_url').value = '';
  document.getElementById('ag_video_titulo').value = '';
  alert('✅ Vídeo adicionado!');
};

window.removerMidia = async (id) => {
  if (!confirm('Remover?')) return;
  await deleteDoc(doc(db, 'galeria', id));
};

// ============ CONVERSOR DE LINKS ============
function converterLink(url, tipo = 'auto') {
  if (!url) return url;
  if (url.includes('share.google') || url.includes('photos.app.goo.gl') || url.includes('goo.gl')) {
    alert('⚠️ Link encurtado não funciona.');
    return null;
  }
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFile) {
    const id = driveFile[1];
    if (tipo === 'video') return `https://drive.google.com/file/d/${id}/preview`;
    return `https://lh3.googleusercontent.com/d/${id}`;
  }
  const driveThumb = url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveThumb) {
    const id = driveThumb[1];
    if (tipo === 'video') return `https://drive.google.com/file/d/${id}/preview`;
    return `https://lh3.googleusercontent.com/d/${id}`;
  }
  const driveId = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveId) {
    const id = driveId[1];
    if (tipo === 'video') return `https://drive.google.com/file/d/${id}/preview`;
    return `https://lh3.googleusercontent.com/d/${id}`;
  }
  return url;
}

window.converterLink = converterLink;

renderDashboard();