const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.STRATEGY_HUB_DB_HOST || '127.0.0.1',
      port: Number(process.env.STRATEGY_HUB_DB_PORT) || 3306,
      user: process.env.STRATEGY_HUB_DB_USER || 'root',
      password: process.env.STRATEGY_HUB_DB_PASSWORD || '',
      database: process.env.STRATEGY_HUB_DB_NAME || 'strategy_hub',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 5000
    });
  }
  return pool;
}

/**
 * Consulta saldos de todos os bancos cadastrados no Strategy Hub
 */
async function getBankBalances() {
  try {
    const p = getPool();
    const [rows] = await p.query(
      `SELECT id, name, bank, type, initial_balance, external_balance, provider, status 
       FROM accounts 
       WHERE status = 'active'
       ORDER BY bank ASC, name ASC`
    );

    let total = 0;
    const contas = rows.map(acc => {
      // Prioriza external_balance sincronizado via Open Finance Pluggy; se nulo, usa initial_balance
      const rawVal = acc.external_balance !== null && acc.external_balance !== undefined
        ? acc.external_balance
        : acc.initial_balance;
      const saldo = parseFloat(rawVal) || 0;
      total += saldo;

      return {
        id: acc.id,
        nome: acc.name,
        banco: acc.bank || acc.name,
        tipo: acc.type,
        saldo: Number(saldo.toFixed(2)),
        origem: acc.external_balance !== null ? 'Open Finance' : 'Manual'
      };
    });

    return {
      ok: true,
      total_consolidado: Number(total.toFixed(2)),
      quantidade_contas: contas.length,
      contas
    };
  } catch (err) {
    return {
      ok: false,
      erro: `Erro ao consultar bancos do Strategy Hub: ${err.message}`
    };
  }
}

/**
 * Consulta cartões de crédito, limites e faturas em aberto
 */
async function getCreditCardsAndInvoices() {
  try {
    const p = getPool();
    const [cards] = await p.query(
      `SELECT id, name, brand, last_digits, total_limit 
       FROM cards 
       WHERE status = 'active'`
    );

    const [invoices] = await p.query(
      `SELECT card_id, invoice_month, due_date, 
              COALESCE(external_total_amount, total_amount, 0) as valor, status 
       FROM credit_card_invoices 
       WHERE status != 'paid' AND status != 'paga'
       ORDER BY due_date ASC`
    );

    let totalFaturas = 0;
    const cartoes = cards.map(c => {
      const inv = invoices.find(i => i.card_id === c.id);
      const valorFatura = inv ? parseFloat(inv.valor) || 0 : 0;
      if (valorFatura > 0) totalFaturas += valorFatura;

      return {
        id: c.id,
        nome: c.name,
        bandeira: c.brand,
        final: c.last_digits,
        limite_total: parseFloat(c.total_limit) || 0,
        fatura_atual: Number(valorFatura.toFixed(2)),
        vencimento: inv && inv.due_date ? String(inv.due_date).substring(0, 10) : null,
        status_fatura: inv ? inv.status : 'sem fatura aberta'
      };
    });

    return {
      ok: true,
      total_faturas_abertas: Number(totalFaturas.toFixed(2)),
      quantidade_cartoes: cartoes.length,
      cartoes
    };
  } catch (err) {
    return {
      ok: false,
      erro: `Erro ao consultar cartões do Strategy Hub: ${err.message}`
    };
  }
}

/**
 * Consulta contas e pagamentos pendentes
 */
async function getPendingBills() {
  try {
    const p = getPool();
    const [rows] = await p.query(
      `SELECT id, description, amount, due_date, transaction_date, type, status, payment_status 
       FROM transactions 
       WHERE (payment_status = 'pending' OR status = 'pending')
       ORDER BY COALESCE(due_date, transaction_date) ASC 
       LIMIT 30`
    );

    let totalPendente = 0;
    const despesas = rows.map(r => {
      const val = parseFloat(r.amount) || 0;
      if (r.type === 'expense' || r.type === 'despesa') {
        totalPendente += val;
      }
      const dataVenc = r.due_date || r.transaction_date;
      return {
        id: r.id,
        descricao: r.description,
        valor: Number(val.toFixed(2)),
        tipo: r.type,
        vencimento: dataVenc ? String(dataVenc).substring(0, 10) : null,
        status: r.payment_status || r.status
      };
    });

    return {
      ok: true,
      total_despesas_pendentes: Number(totalPendente.toFixed(2)),
      quantidade_pendencias: despesas.length,
      contas: despesas
    };
  } catch (err) {
    return {
      ok: false,
      erro: `Erro ao consultar contas a pagar do Strategy Hub: ${err.message}`
    };
  }
}

module.exports = {
  getBankBalances,
  getCreditCardsAndInvoices,
  getPendingBills
};
