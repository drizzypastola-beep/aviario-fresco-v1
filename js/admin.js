import {
  db, collection, doc, updateDoc, deleteDoc, addDoc,
  onSnapshot, serverTimestamp, query, orderBy, setDoc
} from "./firebase.js";

const SENHA = "Pastola13";

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
let videoDestaqueUrl = '';

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
}

window.adminTab = (tab, btn) => {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  ['dashboard','produtos','stock','encomendas','galeria'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
};

// ============ DASHBOARD ============
function renderDashboard() {
  const pendentes = encomendas.filter(e => e.estado !== 'entregue').length;
  const receita = encomendas.filter(e => e.estado === 'entregue').reduce((s, e) => s + (e.total || 0), 0);
  document.getElementById('tab-dashboard').innerHTML = `
    <div class="resumo-dashboard">
      <div class="resumo-card"><h4>Encomendas</h4><div class="valor">${encomendas.length}</div></div>
      <div class="resumo-card"><h4>Pendentes</h4><div class="valor">${pendentes}</div></div>
      <div class="resumo-card"><h4>Receita</h4><div class="valor">${receita} MZN</div></div>
      <div class="resumo-card"><h4>Produtos</h4><div class="valor">${produtos.length}</div></div>
    </div>
  `;
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
          <label>Link da imagem (Google Drive, ImgBB ou URL direto)</label>
          <input id="np_img" placeholder="https://drive.google.com/file/d/...">
          <small style="color:#888;font-size:11px;">Cola o link do Google Drive normal — o sistema converte automaticamente.</small>
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

  // Valida o link de imagem (se foi fornecido)
  let imgFinal = '';
  if (imgInput) {
    imgFinal = converterLink(imgInput, 'foto');
    if (imgFinal === null) return; // aviso já mostrado
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
function renderEncomendas() {
  let html = '<h3 style="margin-bottom:10px;">🛒 Encomendas</h3>';
  if (encomendas.length === 0) html += '<p style="text-align:center;color:#999;padding:20px;">Sem encomendas.</p>';
  encomendas.forEach(e => {
    const estado = e.estado || 'nova';
    const data = e.criadaEm?.toDate ? e.criadaEm.toDate().toLocaleString('pt-MZ') : '—';
    html += `
      <div class="card-admin">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <strong>${e.cliente}</strong>
          <span class="badge-estado estado-${estado}">${estado.toUpperCase()}</span>
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">📞 ${e.telefone} · ${data}</div>
        <div style="font-size:13px;margin-bottom:8px;">
          ${(e.itens||[]).map(i => `• ${i.nome} (${i.tipo === 'kg' ? i.qtd + 'kg' : i.qtd + 'un'})`).join('<br>')}
        </div>
        <div style="font-weight:bold;color:#e07b00;margin-bottom:8px;">Total: ${e.total} MZN</div>
        <div style="font-size:12px;color:#666;margin-bottom:10px;">
          ${e.tipoEntrega === 'entrega' ? '🚚 ' + (e.zona || '') + ' — ' + (e.endereco || '') : '🏠 Retirada'}
          ${e.pagamento ? '<br>💳 ' + e.pagamento : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn-editar" onclick="mudarEstado('${e.id}','confirmada')">✅ Confirmar</button>
          <button class="btn-editar" onclick="mudarEstado('${e.id}','pronta')">✔️ Pronta</button>
          <button class="btn-editar" onclick="mudarEstado('${e.id}','entregue')">🎉 Entregue</button>
          <a class="btn-editar" style="text-decoration:none;" target="_blank"
             href="https://wa.me/${(e.telefone||'').replace(/\\D/g,'')}">💬 WhatsApp</a>
        </div>
      </div>
    `;
  });
  document.getElementById('tab-encomendas').innerHTML = html;
}

window.mudarEstado = async (id, estado) => {
  await updateDoc(doc(db, 'encomendas', id), { estado });
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
      <div class="form-linha full">
        <div>
          <label>Link da imagem (Google Drive, ImgBB ou URL direto)</label>
          <input id="ag_foto_url" placeholder="https://drive.google.com/file/d/...">
          <small style="color:#888;font-size:11px;">Cola o link normal do Drive — o sistema converte.</small>
        </div>
      </div>
      <div class="form-linha full"><div>
        <label>Título (opcional)</label>
        <input id="ag_foto_titulo" placeholder="Ex.: Nossos frangos">
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
        <input id="ag_video_titulo" placeholder="Ex.: Frangos no capoeira">
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
  if (urlConvertida === null) return; // já avisou

  const titulo = document.getElementById('ag_foto_titulo').value.trim();
  await addDoc(collection(db, 'galeria'), {
    tipo: 'foto',
    url: urlConvertida,
    titulo: titulo || 'Foto',
    criadaEm: serverTimestamp()
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
    tipo: 'video',
    url: urlConvertida,
    titulo: titulo || 'Vídeo',
    criadaEm: serverTimestamp()
  });
  document.getElementById('ag_video_url').value = '';
  document.getElementById('ag_video_titulo').value = '';
  alert('✅ Vídeo adicionado!');
};

window.removerMidia = async (id) => {
  if (!confirm('Remover?')) return;
  await deleteDoc(doc(db, 'galeria', id));
};

// ============ CONVERSOR DE LINKS (MELHORADO) ============
function converterLink(url, tipo = 'auto') {
  if (!url) return url;

  // ❌ Bloqueia encurtadores que não funcionam
  if (url.includes('share.google') || url.includes('photos.app.goo.gl') || url.includes('goo.gl')) {
    alert(
      '⚠️ ATENÇÃO!\n\n' +
      'O link que colaste NÃO funciona (é um link encurtado).\n\n' +
      'Como obter o link correto:\n\n' +
      '1. Abre a app Google Drive\n' +
      '2. Toca na foto\n' +
      '3. Toca em ⋮ (3 pontinhos)\n' +
      '4. Escolhe "Copiar link"\n\n' +
      'O link deve começar com:\n' +
      'https://drive.google.com/file/d/\n\n' +
      'Link que colaste: ' + url.substring(0, 50) + '...'
    );
    return null;
  }

  // ✅ Google Drive: /file/d/ID/view
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const id = driveMatch[1];
    if (tipo === 'video') {
      return `https://drive.google.com/file/d/${id}/preview`;
    } else {
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }

  // ✅ Google Drive: /thumbnail?id=ID
  const driveThumb = url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveThumb) {
    const id = driveThumb[1];
    if (tipo === 'video') {
      return `https://drive.google.com/file/d/${id}/preview`;
    } else {
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }

  // ✅ Google Drive: ?id=ID (open?id=)
  const driveIdMatch = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch) {
    const id = driveIdMatch[1];
    if (tipo === 'video') {
      return `https://drive.google.com/file/d/${id}/preview`;
    } else {
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }

  // ✅ ImgBB, unsplash e outros links diretos → devolve como está
  return url;
}

// Expõe para uso em outros ficheiros
window.converterLink = converterLink;

renderDashboard();
