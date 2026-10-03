const tls = require('tls');

/**
 * Conector modular para consulta de e-mails não lidos na Caixa de Entrada.
 * Projetado para suportar Gmail (via Senha de App), Outlook ou qualquer provedor IMAP seguro.
 * 
 * Se as variáveis EMAIL_USER e EMAIL_PASS não estiverem configuradas,
 * o conector responde de forma graciosa sem travar o sistema.
 */
async function getUnreadCount() {
  const host = process.env.EMAIL_HOST || 'imap.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT, 10) || 993;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD;

  // Se não configurado, retorna status inativo sem erro (modo standby)
  if (!user || !pass) {
    return {
      configurado: false,
      total_nao_lidos: 0,
      mensagem: 'Integração de e-mails pronta para ser vinculada com Senha de App no .env'
    };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const socket = tls.connect(port, host, { timeout: 3500 }, () => {
      // Conexão TLS estabelecida, envia comando de login
      socket.write(`A1 LOGIN "${user}" "${pass}"\r\n`);
    });

    let buffer = '';
    let unreadCount = 0;

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      try { socket.end(); } catch (_) {}
      resolve(result);
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString();

      // Checa resposta do LOGIN
      if (buffer.includes('A1 OK')) {
        buffer = '';
        socket.write('A2 STATUS INBOX (UNSEEN)\r\n');
      } else if (buffer.includes('A1 NO') || buffer.includes('A1 BAD')) {
        finish({
          configurado: true,
          ok: false,
          total_nao_lidos: 0,
          erro: 'Credenciais de e-mail recusadas pelo provedor IMAP'
        });
      }

      // Checa resposta do STATUS INBOX
      if (buffer.includes('A2 OK')) {
        const match = buffer.match(/UNSEEN\s+(\d+)/i);
        if (match) {
          unreadCount = parseInt(match[1], 10);
        }
        socket.write('A3 LOGOUT\r\n');
        finish({
          configurado: true,
          ok: true,
          total_nao_lidos: unreadCount,
          resumo: unreadCount === 0
            ? 'Caixa de entrada limpa, sem novos e-mails não lidos.'
            : `Você tem ${unreadCount} novo(s) e-mail(s) não lido(s) na Caixa de Entrada.`
        });
      } else if (buffer.includes('A2 NO') || buffer.includes('A2 BAD')) {
        finish({
          configurado: true,
          ok: false,
          total_nao_lidos: 0,
          erro: 'Falha ao consultar pasta INBOX'
        });
      }
    });

    socket.on('error', (err) => {
      finish({
        configurado: true,
        ok: false,
        total_nao_lidos: 0,
        erro: `Erro de conexão IMAP: ${err.message}`
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      finish({
        configurado: true,
        ok: false,
        total_nao_lidos: 0,
        erro: 'Timeout ao consultar servidor de e-mail'
      });
    });
  });
}

module.exports = {
  getUnreadCount
};
