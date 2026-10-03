const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.ESTRATEGIA_NERD_DB_HOST || '127.0.0.1',
      port: Number(process.env.ESTRATEGIA_NERD_DB_PORT) || 3306,
      user: process.env.ESTRATEGIA_NERD_DB_USER || 'root',
      password: process.env.ESTRATEGIA_NERD_DB_PASSWORD || '',
      database: process.env.ESTRATEGIA_NERD_DB_NAME || 'estrategia-nerd',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 5000
    });
  }
  return pool;
}

/**
 * Consulta posts agendados tanto do Blog quanto do Instagram
 * @param {Object} [options]
 * @param {string} [options.canal] - 'todos', 'blog' ou 'instagram'
 */
async function getScheduledPosts(options = {}) {
  try {
    const p = getPool();
    const canal = (options.canal || 'todos').toLowerCase();

    let blogAgendados = [];
    let instagramAgendados = [];

    if (canal === 'todos' || canal === 'blog') {
      const [bRows] = await p.query(
        `SELECT id, titulo, data_publicacao, categoria, tipo_post 
         FROM posts 
         WHERE status = 'agendado' 
         ORDER BY data_publicacao ASC 
         LIMIT 15`
      );
      blogAgendados = bRows.map(r => {
        let dt = r.data_publicacao;
        if (dt instanceof Date) {
          dt = dt.toISOString().substring(0, 10);
        } else if (dt) {
          dt = String(dt).substring(0, 10);
        }
        return {
          id: r.id,
          canal: 'Blog',
          titulo: r.titulo,
          categoria: r.categoria,
          tipo: r.tipo_post || 'artigo',
          data_agendada: dt
        };
      });
    }

    if (canal === 'todos' || canal === 'instagram') {
      const [igRows] = await p.query(
        `SELECT id, tipo, agendado_para, SUBSTRING(legenda, 1, 60) as preview 
         FROM instagram_posts 
         WHERE status = 'agendado' 
         ORDER BY agendado_para ASC 
         LIMIT 15`
      );
      instagramAgendados = igRows.map(r => {
        let dt = r.agendado_para;
        if (dt instanceof Date) {
          dt = dt.toISOString().substring(0, 10);
        } else if (dt) {
          dt = String(dt).substring(0, 10);
        }
        return {
          id: r.id,
          canal: 'Instagram',
          tipo: r.tipo || 'post',
          preview_legenda: r.preview ? r.preview.trim() + '...' : 'Sem legenda',
          data_agendada: dt
        };
      });
    }

    return {
      ok: true,
      total_blog_agendados: blogAgendados.length,
      total_instagram_agendados: instagramAgendados.length,
      posts: [...blogAgendados, ...instagramAgendados]
    };
  } catch (err) {
    return {
      ok: false,
      erro: `Erro ao consultar agendamento no Estratégia Nerd: ${err.message}`
    };
  }
}

/**
 * Consulta métricas consolidadas do Blog Estratégia Nerd
 */
async function getBlogMetrics() {
  try {
    const p = getPool();
    const [statusCounts] = await p.query(
      `SELECT status, COUNT(*) as total, COALESCE(SUM(views), 0) as total_views, COALESCE(SUM(curtidas), 0) as total_likes 
       FROM posts 
       GROUP BY status`
    );

    const [topPosts] = await p.query(
      `SELECT id, titulo, views, curtidas 
       FROM posts 
       WHERE status = 'publicado' 
       ORDER BY views DESC 
       LIMIT 5`
    );

    let publicados = 0;
    let agendados = 0;
    let rascunhos = 0;
    let totalViews = 0;
    let totalLikes = 0;

    for (const row of statusCounts) {
      if (row.status === 'publicado') {
        publicados = row.total;
        totalViews = parseInt(row.total_views, 10);
        totalLikes = parseInt(row.total_likes, 10);
      } else if (row.status === 'agendado') {
        agendados = row.total;
      } else if (row.status === 'rascunho') {
        rascunhos = row.total;
      }
    }

    return {
      ok: true,
      canal: 'Blog',
      artigos_publicados: publicados,
      artigos_agendados: agendados,
      artigos_rascunhos: rascunhos,
      total_visualizacoes: totalViews,
      total_curtidas: totalLikes,
      top_artigos: topPosts.map(t => ({
        id: t.id,
        titulo: t.titulo,
        views: t.views,
        curtidas: t.curtidas
      }))
    };
  } catch (err) {
    return {
      ok: false,
      erro: `Erro ao consultar métricas do Blog Estratégia Nerd: ${err.message}`
    };
  }
}

/**
 * Consulta métricas consolidadas do Instagram do Estratégia Nerd
 */
async function getInstagramMetrics() {
  try {
    const p = getPool();
    const [counts] = await p.query(
      `SELECT status, COUNT(*) as total, COALESCE(SUM(curtidas), 0) as curtidas, COALESCE(SUM(comentarios_count), 0) as comentarios 
       FROM instagram_posts 
       GROUP BY status`
    );

    let publicados = 0;
    let agendados = 0;
    let totalCurtidas = 0;
    let totalComentarios = 0;

    for (const r of counts) {
      if (r.status === 'publicado') {
        publicados = r.total;
        totalCurtidas = parseInt(r.curtidas, 10);
        totalComentarios = parseInt(r.comentarios, 10);
      } else if (r.status === 'agendado') {
        agendados = r.total;
      }
    }

    // Busca conta e seguidores se disponível
    const [accounts] = await p.query(
      `SELECT username, followers_count, media_count FROM instagram_accounts LIMIT 1`
    );
    const conta = accounts.length > 0 ? accounts[0] : null;

    return {
      ok: true,
      canal: 'Instagram',
      perfil: conta ? conta.username : '@estrategianerd',
      seguidores: conta ? conta.followers_count : null,
      posts_publicados: publicados,
      posts_agendados: agendados,
      total_curtidas_registradas: totalCurtidas,
      total_comentarios_registrados: totalComentarios
    };
  } catch (err) {
    return {
      ok: false,
      erro: `Erro ao consultar métricas do Instagram Estratégia Nerd: ${err.message}`
    };
  }
}

module.exports = {
  getScheduledPosts,
  getBlogMetrics,
  getInstagramMetrics
};
