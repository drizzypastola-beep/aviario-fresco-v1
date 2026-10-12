import {
  db, collection, doc, getDoc, updateDoc, addDoc,
  serverTimestamp, onSnapshot
} from "./firebase.js";
import { CONFIG_AVIARIO } from "./config.js";

let produtos = [];
let midia = [];
let videoDestaqueUrl = '';
let carrinho = [];
let filtroAtual = 'todos';
let produtoEscolhido = null;
window.tipoEscolhido = 'un';

// Listeners em tempo real
onSnapshot(collection(db, 'produtos'), snap => {
  produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderizar();
}, err => console.error('Erro produtos:', err));

onSnapshot(collection(db, 'galeria'), snap => {
  midia = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGaleria();
}, err => console.error('Erro galeria:', err));

onSnapshot(doc(db, 'config', 'site'), snap => {
  if (snap.exists()) {
    videoDestaqueUrl = snap.data().videoDestaqueUrl || '';
    renderGaleria();
  }
}, err => console.error('Erro config:', err));

// LOJA
function renderizar() {
  const lista = document.getElementById('listaProdutos');
  if (produtos.length === 0) {
    lista.innerHTML = '<p style="text-align:center;color:#999;padding:30px;">Nenhum produto disponível.</p>';
    return;
  }
  lista.innerHTML = '';
  const filtrados = filtroAtual === 'todos' ? produtos : produtos.filter(p => p.cat === filtroAtual);
  if (filtrados.length === 0) {
    lista.innerHTML = '<p style="text-align:center;color:#999;padding:30px;">Nenhum produto nesta categoria.</p>';
    return;
  }
  filtrados.forEach(p => {
    let estado = 'disponivel', texto = `✅ Disponível (${p.stock})`;
    if (p.stock === 0) { estado = 'esgotado'; texto = '❌ Esgotado'; }
    else if (p.stock <= 10) { estado = 'pouco'; texto = `⚠️ Últimas (${p.stock})`; }
    const precoTexto = p.soUnidade
      ? `${p.precoUn} MZN / unidade`
      : `${p.precoKg} MZN/kg · ${p.precoUn} MZN/unid.`;
    const img = normalizarLinkImg(p.img) || 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=200';
    lista.innerHTML += `
      <div class="produto">
        <img src="${img}" alt="${p.nome}">
        <div class="produto-info">
          <h3>${p.nome}</h3>
          <div class="desc">${p.desc || ''}</div>
          <div class="preco">${precoTexto}</div>
          <div class="stock ${estado}">${texto}</div>
          <button class="btn-add" onclick="escolherQtd('${p.id}')" ${p.stock===0?'disabled':''}>
            ${p.stock===0 ? 'Indisponível' : '+ Adicionar'}
          </button>
        </div>
      </div>
    `;
  });
}

window.filtrar = (cat, btn) => {
  filtroAtual = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  renderizar();
};

window.escolherQtd = (id) => {
  produtoEscolhido = produtos.find(p => p.id === id);
  const p = produtoEscolhido;
  const modal = document.getElementById('modalQtd');
  window.tipoEscolhido = p.soUnidade ? 'un' : 'un';
  let html = `<h3 style="margin-bottom:12px;color:#333;">${p.nome}</h3>`;
  if (!p.soUnidade) {
    html += `
      <div class="opcoes-tipo">
        <div class="opcao-tipo ativo" id="tipoUn" onclick="mudarTipo('un')">🐔 Por unidade</div>
        <div class="opcao-tipo" id="tipoKg" onclick="mudarTipo('kg')">⚖️ Por kg</div>
      </div>
    `;
  }
  html += `
    <div class="campo">
      <label id="labelQtd">${p.soUnidade ? 'Quantas dúzias?' : 'Quantas unidades?'}</label>
      <input type="number" id="qtdInput" min="1" value="1" style="font-size:18px; padding:14px; text-align:center;">
    </div>
    <div id="infoKg" class="aviso" style="display:none;">
      🐔 <strong>Vivo:</strong> o peso final será confirmado no dia. O preço é estimativa (~${p.pesoMedio || 2}kg).
    </div>
    <div class="campo" style="margin-top:12px;">
      <label>Observação</label>
      <input type="text" id="obsItem" placeholder="Ex.: prefiro maior">
    </div>
    <div style="background:#fff8e7; padding:12px; border-radius:10px; margin-top:12px; text-align:center;">
      <div style="font-size:12px; color:#7a5000;">Estimativa</div>
      <div style="font-size:22px; font-weight:bold; color:#e07b00;" id="estimativa">${p.precoUn} MZN</div>
    </div>
    <button class="btn-finalizar" onclick="confirmarItem()" style="margin-top:14px;">🛒 Adicionar ao carrinho</button>
    <button class="btn-fechar" onclick="fecharQtd()">Cancelar</button>
  `;
  document.getElementById('conteudoQtd').innerHTML = html;
  modal.classList.add('ativo');
  document.getElementById('qtdInput').oninput = atualizarEstimativa;
};

window.mudarTipo = (tipo) => {
  window.tipoEscolhido = tipo;
  document.getElementById('tipoUn')?.classList.toggle('ativo', tipo === 'un');
  document.getElementById('tipoKg')?.classList.toggle('ativo', tipo === 'kg');
  document.getElementById('labelQtd').textContent = tipo === 'kg' ? 'Quantos kg (aprox.)?' : 'Quantas unidades?';
  document.getElementById('infoKg').style.display = tipo === 'kg' ? 'block' : 'none';
  atualizarEstimativa();
};

function atualizarEstimativa() {
  const p = produtoEscolhido;
  if (!p) return;
  const qtd = parseFloat(document.getElementById('qtdInput').value) || 0;
  const total = window.tipoEscolhido === 'kg' ? qtd * p.precoKg : qtd * p.precoUn;
  document.getElementById('estimativa').textContent = Math.round(total) + ' MZN';
}

window.confirmarItem = () => {
  const p = produtoEscolhido;
  const qtd = parseFloat(document.getElementById('qtdInput').value) || 0;
  if (qtd <= 0) { alert('Quantidade inválida'); return; }
  const obs = document.getElementById('obsItem').value;
  const tipo = window.tipoEscolhido;
  const preco = tipo === 'kg' ? p.precoKg : p.precoUn;
  carrinho.push({
    id: p.id + '-' + tipo + '-' + Date.now(),
    produtoId: p.id,
    nome: p.nome,
    tipo, qtd, preco, obs,
    subtotal: Math.round(qtd * preco)
  });
  atualizarCarrinho();
  fecharQtd();
};

window.fecharQtd = () => {
  document.getElementById('modalQtd').classList.remove('ativo');
  produtoEscolhido = null;
};

function atualizarCarrinho() {
  const total = carrinho.reduce((s, i) => s + i.subtotal, 0);
  const qtd = carrinho.length;
  document.getElementById('contador').textContent = qtd;
  document.getElementById('totalFloat').textContent = total + ' MZN';
  document.getElementById('carrinhoFloat').classList.toggle('visivel', qtd > 0);
}

window.abrirCarrinho = () => {
  const modal = document.getElementById('modal');
  const conteudo = document.getElementById('conteudoCarrinho');
  const checkout = document.getElementById('areaCheckout');
  if (carrinho.length === 0) {
    conteudo.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Carrinho vazio 🛒</p>';
    checkout.style.display = 'none';
  } else {
    let html = '';
    carrinho.forEach(i => {
      html += `
        <div class="item-carrinho">
          <div>
            <strong>${i.nome}</strong><br>
            <small>${i.tipo === 'kg' ? i.qtd + ' kg' : i.qtd + ' unid.'} × ${i.preco} MZN = <strong>${i.subtotal} MZN</strong></small>
            ${i.obs ? `<br><small style="color:#999;">Obs: ${i.obs}</small>` : ''}
          </div>
          <button onclick="remover('${i.id}')">Remover</button>
        </div>
      `;
    });
    const total = carrinho.reduce((s, i) => s + i.subtotal, 0);
    html += `<div class="total">Total: ${total} MZN</div>`;
    conteudo.innerHTML = html;
    checkout.style.display = 'block';
  }
  modal.classList.add('ativo');
};

window.remover = (id) => {
  carrinho = carrinho.filter(i => i.id !== id);
  atualizarCarrinho();
  abrirCarrinho();
};

window.fecharCarrinho = () => {
  document.getElementById('modal').classList.remove('ativo');
};

window.toggleEndereco = () => {
  const tipo = document.getElementById('tipoEntrega').value;
  document.getElementById('campoEndereco').style.display = tipo === 'entrega' ? 'block' : 'none';
};

window.finalizar = async () => {
  const nome = document.getElementById('nome').value.trim();
  const tel = document.getElementById('telefone').value.trim();
  if (!nome || !tel) { alert('Preencha nome e telefone'); return; }
  if (carrinho.length === 0) { alert('Carrinho vazio'); return; }
  const tipo = document.getElementById('tipoEntrega').value;
  const zona = document.getElementById('zona').value;
  const end = document.getElementById('endereco').value;
  const data = document.getElementById('data').value;
  const obs = document.getElementById('obs').value;
  const pag = document.getElementById('pagamento').value;
  const total = carrinho.reduce((s, i) => s + i.subtotal, 0);
  try {
    await addDoc(collection(db, 'encomendas'), {
      cliente: nome, telefone: tel,
      itens: carrinho.map(i => ({ nome: i.nome, tipo: i.tipo, qtd: i.qtd, preco: i.preco, subtotal: i.subtotal, obs: i.obs || '' })),
      total,
      tipoEntrega: tipo,
      zona: tipo === 'entrega' ? zona : '',
      endereco: tipo === 'entrega' ? end : '',
      dataDesejada: data,
      observacoes: obs,
      pagamento: pag,
      estado: 'nova',
      criadaEm: serverTimestamp()
    });
    for (const item of carrinho) {
      const prodRef = doc(db, 'produtos', item.produtoId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const novoStock = Math.max(0, (prodSnap.data().stock || 0) - item.qtd);
        await updateDoc(prodRef, { stock: novoStock });
      }
    }
  } catch (e) {
    console.error('Erro ao guardar:', e);
  }
  let msg = `*NOVA ENCOMENDA — ${CONFIG_AVIARIO.nome}* 🐔%0A%0A`;
  msg += `*Cliente:* ${nome}%0A*Telefone:* ${tel}%0A%0A*ITENS:*%0A`;
  carrinho.forEach(i => {
    msg += `• ${i.nome} — ${i.tipo === 'kg' ? i.qtd + 'kg' : i.qtd + ' unid.'} = ${i.subtotal} MZN%0A`;
    if (i.obs) msg += `   _Obs: ${i.obs}_%0A`;
  });
  msg += `%0A*Total estimado:* ${total} MZN%0A`;
  msg += `*Entrega:* ${tipo === 'entrega' ? 'Entrega' : 'Retirada'}%0A`;
  if (tipo === 'entrega') { msg += `*Zona:* ${zona}%0A*Endereço:* ${end}%0A`; }
  if (data) msg += `*Data:* ${data}%0A`;
  msg += `*Pagamento:* ${pag}%0A`;
  if (obs) msg += `*Obs:* ${obs}%0A`;
  window.open(`https://wa.me/${CONFIG_AVIARIO.whatsapp}?text=${msg}`, '_blank');
  carrinho = [];
  atualizarCarrinho();
  fecharCarrinho();
};

// ============ GALERIA ============
function renderGaleria() {
  const vd = document.getElementById('videoDestaque');
  vd.innerHTML = videoDestaqueUrl ? `<div class="video-destaque">${gerarPlayer(videoDestaqueUrl)}</div>` : '';
  const grid = document.getElementById('galeriaGrid');
  grid.innerHTML = '';
  midia.forEach(m => {
    const div = document.createElement('div');
    div.className = 'galeria-item';
    div.onclick = () => abrirLightbox(m);
    if (m.tipo === 'foto') {
      const img = normalizarLinkImg(m.url) || 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=200';
      div.innerHTML = `<img src="${img}" alt="${m.titulo || ''}">`;
    } else {
      const thumb = extrairThumb(m.url);
      div.innerHTML = thumb ? `<img src="${thumb}"><div class="play-icon">▶️</div>` : `<div class="play-icon" style="background:#333;">▶️</div>`;
    }
    grid.appendChild(div);
  });
  document.getElementById('galeriaSecao').style.display = (midia.length === 0 && !videoDestaqueUrl) ? 'none' : 'block';
}

function gerarPlayer(url) {
  if (!url) return '';

  // ✅ Google Drive: /file/d/ID
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFile) {
    return `<iframe src="https://drive.google.com/file/d/${driveFile[1]}/preview" allow="autoplay" allowfullscreen></iframe>`;
  }

  // ✅ Google Drive: /thumbnail?id=ID
  const driveThumb = url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveThumb) {
    return `<iframe src="https://drive.google.com/file/d/${driveThumb[1]}/preview" allow="autoplay" allowfullscreen></iframe>`;
  }

  // ✅ Google Drive: ?id=ID
  const driveId = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveId) {
    return `<iframe src="https://drive.google.com/file/d/${driveId[1]}/preview" allow="autoplay" allowfullscreen></iframe>`;
  }

  // ✅ YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const id = extrairYouTubeId(url);
    return `<iframe src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>`;
  }

  // ✅ Vimeo
  if (url.includes('vimeo.com')) {
    const id = url.split('/').pop();
    return `<iframe src="https://player.vimeo.com/video/${id}" allowfullscreen></iframe>`;
  }

  // Fallback: ficheiro .mp4 direto
  return `<video src="${url}" controls></video>`;
}

function extrairYouTubeId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?/]+)/);
  return m ? m[1] : '';
}

function extrairThumb(url) {
  if (!url) return '';

  // ✅ Google Drive: /file/d/ID
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFile) {
    return `https://lh3.googleusercontent.com/d/${driveFile[1]}`;
  }

  // ✅ Google Drive: /thumbnail?id=ID
  const driveThumb = url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveThumb) {
    return `https://lh3.googleusercontent.com/d/${driveThumb[1]}`;
  }

  // ✅ Google Drive: ?id=ID
  const driveId = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId[1]}`;
  }

  // ✅ YouTube
  const ytId = extrairYouTubeId(url);
  return ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';
}

// ============ NORMALIZAR LINK DE IMAGEM ============
// Usada para produtos E galeria — aceita todos os formatos do Drive
function normalizarLinkImg(url) {
  if (!url) return url;

  // ✅ Google Drive: /file/d/ID
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFile) {
    return `https://lh3.googleusercontent.com/d/${driveFile[1]}`;
  }

  // ✅ Google Drive: /thumbnail?id=ID
  const driveThumb = url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveThumb) {
    return `https://lh3.googleusercontent.com/d/${driveThumb[1]}`;
  }

  // ✅ Google Drive: ?id=ID
  const driveId = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId[1]}`;
  }

  // ✅ ImgBB, unsplash e outros links diretos → devolve como está
  return url;
}

function abrirLightbox(m) {
  const lb = document.getElementById('lightbox');
  const c = document.getElementById('lightboxConteudo');
  if (m.tipo === 'foto') {
    const img = normalizarLinkImg(m.url) || 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=200';
    c.innerHTML = `<img src="${img}">`;
  } else {
    c.innerHTML = gerarPlayer(m.url);
  }
  lb.classList.add('ativo');
}

window.fecharLightbox = (e) => {
  if (e && e.target.id !== 'lightbox' && !e.target.classList.contains('lightbox-fechar')) return;
  document.getElementById('lightbox').classList.remove('ativo');
  document.getElementById('lightboxConteudo').innerHTML = '';
};

atualizarCarrinho();
