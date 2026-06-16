const API_AVALIACOES = `${API_BASE}/api/avaliacoes`;

async function buscarAvaliacoes(arvoreId) {
    const resp = await authFetch(`${API_AVALIACOES}/arvore/${arvoreId}`);
    if (!resp.ok) throw new Error('Erro ao buscar avaliações');
    return resp.json();
}

async function buscarMinhasAvaliacoes() {
    const resp = await authFetch(`${API_AVALIACOES}/usuario`, {
        headers: { 'Content-Type': 'application/json' }
    });
    if (!resp.ok) throw new Error('Erro ao buscar suas avaliações');
    return resp.json();
}

async function criarAvaliacao(arvoreId, nota, comentario) {
    const resp = await authFetch(API_AVALIACOES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arvoreId, nota, comentario })
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Erro ao criar avaliação');
    }
    return resp.json();
}

async function editarAvaliacao(id, arvoreId, nota, comentario) {
    const resp = await authFetch(`${API_AVALIACOES}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arvoreId, nota, comentario })
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Erro ao editar avaliação');
    }
    return resp.json();
}

async function excluirAvaliacao(id) {
    const resp = await authFetch(`${API_AVALIACOES}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Erro ao excluir avaliação');
    }
}
