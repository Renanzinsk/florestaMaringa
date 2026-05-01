const QTD_ARVORES = 140000;
const AREA = { lat: -23.4205, lng: -51.9333, span: 0.1 };

function gerarDados(qtd) {
    const dados = [];
    for (let i = 0; i < qtd; i++) {
        dados.push({
            id: i,
            latitude: AREA.lat + (Math.random() - 0.5) * AREA.span,
            longitude: AREA.lng + (Math.random() - 0.5) * AREA.span,
            popularName: `Árvore ${i}`,
            scientificName: `Especie ${i}`
        });
    }
    return dados;
}

function runBenchmark() {
    console.log(`=== BENCHMARK: ${QTD_ARVORES.toLocale()} itens ===`);
    
    const arvores = gerarDados(QTD_ARVORES);
    
    const geojson = arvores.map(arvore => ({
        type: 'Feature',
        properties: { id: arvore.id, popularName: arvore.popularName },
        geometry: {
            type: 'Point',
            coordinates: [arvore.longitude, arvore.latitude]
        }
    }));
    
    const index = new Supercluster({
        radius: 40,
        maxZoom: 16,
        minPoints: 3
    });
    
    const t1 = performance.now();
    index.load(geojson);
    console.log(`Carregamento: ${(performance.now() - t1).toFixed(2)}ms`);
    
    const bbox = [[AREA.lng - 0.05, AREA.lat - 0.05], [AREA.lng + 0.05, AREA.lat + 0.05]];
    
    for (let zoom = 10; zoom <= 16; zoom++) {
        const t0 = performance.now();
        const clusters = index.getClusters(bbox, zoom);
        const tempo = performance.now() - t0;
        console.log(`Zoom ${zoom}: ${tempo.toFixed(2)}ms | ${clusters.length} clusters`);
    }
    
    console.log('=== FIM ===');
}

runBenchmark();