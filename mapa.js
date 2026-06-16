const mapa = L.map('meu_mapa').setView([-23.4205, -51.9333], 13);

function initTiles(consent) {
    if (consent === 'accepted' || consent === null) {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(mapa);
    } else {
        L.tileLayer('', { maxZoom: 19 }).addTo(mapa);
    }
}

const cookieConsent = localStorage.getItem('cookieConsent');
initTiles(cookieConsent);

const camadaClusters = L.layerGroup().addTo(mapa);
const camadaArvores = L.layerGroup().addTo(mapa);

const iconArvore = L.icon({
    iconUrl: 'icons/icon.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const iconCluster = L.divIcon({
    className: 'cluster-marker',
    html: '<div class="cluster-circle"></div>',
    iconSize: [28, 28]
});

let supercluster = null;
let todasArvores = [];
let cacheDados = new Map();
let abortController = null;
let debounceTimer = null;

const LIMITE_TELA = 200;
let filtroNome = null;
let isShuffle = true;

function debounce(fn, delay) {
    return (...args) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fn(...args), delay);
    };
}

function setFiltroNome(nome) {
    filtroNome = nome;
}

function getCentroViewport() {
    const bounds = mapa.getBounds();
    return {
        lat: (bounds.getNorth() + bounds.getSouth()) / 2,
        lng: (bounds.getWest() + bounds.getEast()) / 2
    };
}

function getCacheKey(bounds) {
    return `${bounds.getSouth().toFixed(4)},${bounds.getNorth().toFixed(4)},${bounds.getWest().toFixed(4)},${bounds.getEast().toFixed(4)}`;
}

function getCache(bounds) {
    return cacheDados.get(getCacheKey(bounds));
}

function setCache(bounds, arvores) {
    cacheDados.set(getCacheKey(bounds), arvores);
    if (cacheDados.size > 20) {
        const firstKey = cacheDados.keys().next().value;
        cacheDados.delete(firstKey);
    }
}

function initSupercluster(arvores) {
    const geojson = arvores.map(a => ({
        type: 'Feature',
        properties: { id: a.id, nome: a.popularName, cientifico: a.scientificName },
        geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] }
    }));
    
    supercluster = new Supercluster({
        radius: 60,
        maxZoom: 17,
        minPoints: 5
    });
    
    supercluster.load(geojson);
}

function renderizarClusters() {
    camadaClusters.clearLayers();
    camadaArvores.clearLayers();
    
    if (!supercluster) return;
    
    const bounds = mapa.getBounds();
    const zoom = mapa.getZoom();
    
    const bbox = [
        bounds.getWest(), bounds.getSouth(),
        bounds.getEast(), bounds.getNorth()
    ];
    
    const clusters = supercluster.getClusters(bbox, zoom);
    
    clusters.forEach(cluster => {
        const [lng, lat] = cluster.geometry.coordinates;
        const props = cluster.properties;
        
        if (cluster.properties.cluster) {
            L.marker([lat, lng], { icon: iconCluster })
                .bindPopup(`<b>${props.point_count} árvores</b>`)
                .addTo(camadaClusters);
        } else {
            function escHtml(str) {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            }

            L.marker([lat, lng], { icon: iconArvore })
                .bindPopup(`<b>${escHtml(props.nome)}</b><br>${escHtml(props.cientifico)}<br><a href="#" data-arvore-id="${escHtml(props.id)}" style="color:#2d6a4f;">Ver avaliações</a>`)
                .on('click', () => abrirModalArvore(props.id))
                .addTo(camadaArvores);
        }
    });
}

function mostraLoading(show) {
    document.getElementById('loading').classList.toggle('show', show);
}

async function carregarArvoresNaTela() {
    const zoom = mapa.getZoom();
    
    if (zoom < 10) {
        camadaClusters.clearLayers();
        camadaArvores.clearLayers();
        return;
    }

    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();

    const bounds = mapa.getBounds();
    
    mostraLoading(true);
    
    const API_ARVORES = `${API_BASE}/api/arvores`;
    let url = `${API_ARVORES}/viewport?minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLng=${bounds.getWest()}&maxLng=${bounds.getEast()}&centerLat=${getCentroViewport().lat}&centerLng=${getCentroViewport().lng}&limit=1000&shuffle=${isShuffle}`;
    
    if (filtroNome) {
        url = `${API_ARVORES}/filter?q=${encodeURIComponent(filtroNome)}&minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLng=${bounds.getWest()}&maxLng=${bounds.getEast()}&centerLat=${getCentroViewport().lat}&centerLng=${getCentroViewport().lng}&limit=1000`;
    }
    
    try {
        const resposta = await fetch(url, { signal: abortController.signal });
        const arvores = await resposta.json();
        
        todasArvores = arvores;
        setCache(bounds, arvores);
        initSupercluster(arvores);
        renderizarClusters();
        
        console.log(`Renderizados ${arvores.length} árvores.`);
    } catch (erro) {
        if (erro.name !== 'AbortError') {
            console.error("Erro:", erro);
        }
    } finally {
        mostraLoading(false);
    }
}

const carregarDebounced = debounce(carregarArvoresNaTela, 300);

mapa.on('load', carregarArvoresNaTela);
mapa.on('moveend', carregarDebounced);
mapa.on('zoomend', carregarDebounced);

setTimeout(carregarArvoresNaTela, 500);

// === Modal de Avaliações ===
let arvoreModalAtual = null;
let avaliacaoEditandoId = null;

const modal = document.getElementById('modalArvore');
const modalClose = document.getElementById('modalClose');
const avaliacoesLista = document.getElementById('avaliacoesLista');
const avaliacaoForm = document.getElementById('avaliacaoForm');
const minhaAvaliacaoInfo = document.getElementById('minhaAvaliacaoInfo');
const formCriarEditar = document.getElementById('formCriarEditar');
const notaSelector = document.getElementById('notaSelector');
const comentarioInput = document.getElementById('comentarioInput');
const btnEnviar = document.getElementById('btnEnviarAvaliacao');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
const loginPrompt = document.getElementById('loginPrompt');
const avaliacaoErro = document.getElementById('avaliacaoErro');

modalClose.addEventListener('click', fecharModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) fecharModal();
});
btnCancelarEdicao.addEventListener('click', cancelarEdicao);

function fecharModal() {
    modal.classList.remove('open');
    arvoreModalAtual = null;
    avaliacaoEditandoId = null;
}

function renderizarNotaSelector(valorSelecionado) {
    notaSelector.innerHTML = '';
    for (let i = 0; i <= 10; i++) {
        const btn = document.createElement('div');
        btn.className = 'nota-bolinha' + (i === valorSelecionado ? ' selected' : '');
        btn.textContent = i;
        btn.dataset.valor = i;
        btn.addEventListener('click', () => {
            notaSelector.querySelectorAll('.nota-bolinha').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        notaSelector.appendChild(btn);
    }
}

function getNotaSelecionada() {
    const sel = notaSelector.querySelector('.nota-bolinha.selected');
    return sel ? parseInt(sel.dataset.valor) : null;
}

function formatarData(dataStr) {
    if (!dataStr) return '';
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR');
}

function renderizarAvaliacoes(avaliacoes) {
    if (avaliacoes.length === 0) {
        avaliacoesLista.innerHTML = '<p class="avaliacao-vazia">Nenhuma avaliação ainda. Seja o primeiro!</p>';
        return;
    }
    avaliacoesLista.innerHTML = avaliacoes.map(a => `
        <div class="comentario-card">
            <div class="comentario-header">
                <span class="comentario-nota">${a.nota}</span>
                <span class="comentario-nome">${a.userName}</span>
            </div>
            ${a.comentario ? `<p class="comentario-texto">${a.comentario}</p>` : ''}
            <span class="comentario-data">${formatarData(a.createdAt)}</span>
        </div>
    `).join('');
}

function mostrarErro(msg) {
    avaliacaoErro.textContent = msg;
    avaliacaoErro.classList.add('show');
}
function limparErro() {
    avaliacaoErro.classList.remove('show');
    avaliacaoErro.textContent = '';
}

async function abrirModalArvore(arvoreId) {
    limparErro();
    const arvore = todasArvores.find(a => a.id === arvoreId);
    if (!arvore) return;
    arvoreModalAtual = arvore;
    avaliacaoEditandoId = null;

    document.getElementById('arvoreModalNome').textContent = arvore.popularName || 'Desconhecida';
    document.getElementById('arvoreModalCientifico').textContent = arvore.scientificName || '';
    document.getElementById('arvoreModalDescricao').textContent = arvore.characteristic || 'Sem descrição.';

    try {
        const avaliacoes = await buscarAvaliacoes(arvoreId);
        renderizarAvaliacoes(avaliacoes);
    } catch (err) {
        avaliacoesLista.innerHTML = '<p class="avaliacao-vazia">Erro ao carregar avaliações.</p>';
    }

    // Mostra seção de avaliação
    avaliacaoForm.style.display = 'block';

    if (!isAuthenticated()) {
        loginPrompt.style.display = 'block';
        minhaAvaliacaoInfo.style.display = 'none';
        formCriarEditar.style.display = 'none';
    } else {
        loginPrompt.style.display = 'none';
        await verificarMinhaAvaliacao(arvoreId);
    }

    modal.classList.add('open');
}

async function verificarMinhaAvaliacao(arvoreId) {
    try {
        const minhas = await buscarMinhasAvaliacoes();
        const minha = minhas.find(a => a.arvoreId === arvoreId);

        if (minha) {
            // Já avaliou — mostra info
            minhaAvaliacaoInfo.style.display = 'block';
            minhaAvaliacaoInfo.innerHTML = `
                <div class="comentario-header">
                    <span class="comentario-nota">${minha.nota}</span>
                    <span class="comentario-nome">Sua avaliação</span>
                </div>
                ${minha.comentario ? `<p class="comentario-texto">${minha.comentario}</p>` : ''}
                <div class="minha-avaliacao-acoes">
                    <button class="btn-avaliacao btn-editar" onclick="iniciarEdicao(${minha.id}, ${minha.nota}, '${(minha.comentario || '').replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-avaliacao btn-excluir" onclick="excluirMinhaAvaliacao(${minha.id})">Excluir</button>
                </div>
            `;
            formCriarEditar.style.display = 'none';
        } else {
            // Não avaliou ainda — mostra form
            minhaAvaliacaoInfo.style.display = 'none';
            formCriarEditar.style.display = 'block';
            renderizarNotaSelector(null);
            comentarioInput.value = '';
            btnEnviar.textContent = 'Enviar Avaliação';
            btnCancelarEdicao.style.display = 'none';
            btnEnviar.onclick = () => submitAvaliacao(arvoreId);
        }
    } catch (err) {
        // Se erro ao buscar, mostra form
        minhaAvaliacaoInfo.style.display = 'none';
        formCriarEditar.style.display = 'block';
        renderizarNotaSelector(null);
        comentarioInput.value = '';
        btnEnviar.textContent = 'Enviar Avaliação';
        btnCancelarEdicao.style.display = 'none';
        btnEnviar.onclick = () => submitAvaliacao(arvoreId);
    }
}

async function submitAvaliacao(arvoreId) {
    limparErro();
    const nota = getNotaSelecionada();
    if (nota === null) {
        mostrarErro('Selecione uma nota de 0 a 10.');
        return;
    }
    const comentario = comentarioInput.value.trim();

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';

    try {
        await criarAvaliacao(arvoreId, nota, comentario);
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar Avaliação';
        // Recarrega
        const avaliacoes = await buscarAvaliacoes(arvoreId);
        renderizarAvaliacoes(avaliacoes);
        await verificarMinhaAvaliacao(arvoreId);
    } catch (err) {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar Avaliação';
        mostrarErro(err.message);
    }
}

function iniciarEdicao(id, nota, comentario) {
    avaliacaoEditandoId = id;
    minhaAvaliacaoInfo.style.display = 'none';
    formCriarEditar.style.display = 'block';
    renderizarNotaSelector(nota);
    comentarioInput.value = comentario;
    btnEnviar.textContent = 'Salvar';
    btnCancelarEdicao.style.display = 'inline-block';
    btnEnviar.onclick = () => submitEdicao();
}

function cancelarEdicao() {
    avaliacaoEditandoId = null;
    if (arvoreModalAtual) {
        verificarMinhaAvaliacao(arvoreModalAtual.id);
    }
}

async function submitEdicao() {
    limparErro();
    const nota = getNotaSelecionada();
    if (nota === null) {
        mostrarErro('Selecione uma nota de 0 a 10.');
        return;
    }
    const comentario = comentarioInput.value.trim();
    if (!avaliacaoEditandoId || !arvoreModalAtual) return;

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Salvando...';

    try {
        await editarAvaliacao(avaliacaoEditandoId, arvoreModalAtual.id, nota, comentario);
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Salvar';
        avaliacaoEditandoId = null;
        const avaliacoes = await buscarAvaliacoes(arvoreModalAtual.id);
        renderizarAvaliacoes(avaliacoes);
        await verificarMinhaAvaliacao(arvoreModalAtual.id);
    } catch (err) {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Salvar';
        mostrarErro(err.message);
    }
}

async function excluirMinhaAvaliacao(id) {
    if (!confirm('Tem certeza que deseja excluir sua avaliação?')) return;

    try {
        await excluirAvaliacao(id);
        if (arvoreModalAtual) {
            const avaliacoes = await buscarAvaliacoes(arvoreModalAtual.id);
            renderizarAvaliacoes(avaliacoes);
            await verificarMinhaAvaliacao(arvoreModalAtual.id);
        }
    } catch (err) {
        mostrarErro(err.message);
    }
}
