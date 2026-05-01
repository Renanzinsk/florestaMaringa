const mapa = L.map('meu_mapa').setView([-23.4205, -51.9333], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(mapa);

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
            L.marker([lat, lng], { icon: iconArvore })
                .bindPopup(`<b>${props.nome}</b><br>${props.cientifico}`)
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
    
    let url = `https://florestaapi.renanzinsk.com.br/api/arvores/viewport?minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLng=${bounds.getWest()}&maxLng=${bounds.getEast()}&centerLat=${getCentroViewport().lat}&centerLng=${getCentroViewport().lng}&limit=1000&shuffle=${isShuffle}`;
    
    if (filtroNome) {
        url = `https://florestaapi.renanzinsk.com.br/api/arvores/filter?q=${encodeURIComponent(filtroNome)}&minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLng=${bounds.getWest()}&maxLng=${bounds.getEast()}&centerLat=${getCentroViewport().lat}&centerLng=${getCentroViewport().lng}&limit=1000`;
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