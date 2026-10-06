// Tela de PIN para quem abre uma página protegida sem o PIN (ex.: /robo.html direto pelo endereço público).
// O PIN vai para /api/auth/verify, que grava o cookie; depois a página recarrega já liberada.
// Tudo embutido (sem arquivos de fora), e nada vindo do pedido é colocado no HTML.

// Pedido de abertura de página (não script, estilo, imagem ou API)
function wantsPage(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (String(req.path || '').startsWith('/api/')) return false;
  const dest = String((req.headers && req.headers['sec-fetch-dest']) || '');
  if (dest) return dest === 'document' || dest === 'iframe';
  return /text\/html/i.test(String((req.headers && req.headers.accept) || ''));
}

function renderPinPage({ blocked = false, retryMinutes = 0 } = {}) {
  const minutes = Math.max(1, Math.ceil(Number(retryMinutes) || 0));
  const notice = blocked ? `Muitas tentativas de PIN. Tente de novo em ${minutes} min.` : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Echo // PIN</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem;
    background: radial-gradient(circle at center, #081630 0%, #01040a 100%) #020617; color: #e2e8f0;
    font-family: Consolas, 'Fira Code', 'Courier New', monospace; }
  form { width: min(100%, 340px); display: flex; flex-direction: column; gap: 0.8rem; padding: 1.4rem;
    background: #07121f; border: 1px solid rgba(0, 229, 255, 0.45); border-radius: 18px; box-shadow: 0 0 30px rgba(0, 229, 255, 0.2); }
  h1 { margin: 0; font-size: 1rem; letter-spacing: 0.12em; color: #00e5ff; }
  p { margin: 0; font-size: 0.85rem; line-height: 1.4; color: #94a3b8; }
  input { min-height: 48px; padding: 0.6rem 0.8rem; border: 1px solid rgba(0, 229, 255, 0.35); border-radius: 12px;
    background: #020b12; color: #f8fafc; font: inherit; font-size: 1.1rem; letter-spacing: 0.3em; text-align: center; }
  button { min-height: 48px; border: 1px solid #00e5ff; border-radius: 12px; background: rgba(0, 229, 255, 0.16);
    color: #f8fafc; font: inherit; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  .erro { min-height: 1.2em; color: #f87171; }
</style>
</head>
<body>
<form id="pin-form" autocomplete="off">
  <h1>ECHO // PIN</h1>
  <p>Esta página é protegida. Digite o PIN do Echo para continuar.</p>
  <input id="pin" type="password" inputmode="numeric" maxlength="32" aria-label="PIN do Echo" required>
  <button id="entrar" type="submit">ENTRAR</button>
  <p class="erro" id="erro" role="alert">${notice}</p>
</form>
<script>
  const form = document.getElementById('pin-form');
  const input = document.getElementById('pin');
  const button = document.getElementById('entrar');
  const erro = document.getElementById('erro');
  input.focus();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pin = input.value.trim();
    if (!pin) return;
    button.disabled = true;
    erro.textContent = '';
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ pin })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        location.reload();
        return;
      }
      erro.textContent = res.status === 429 ? (data.error || 'Muitas tentativas de PIN. Tente mais tarde.') : 'PIN incorreto.';
    } catch (_) {
      erro.textContent = 'Não foi possível validar o PIN. Tente de novo.';
    }
    button.disabled = false;
    input.select();
  });
</script>
</body>
</html>`;
}

module.exports = { wantsPage, renderPinPage };
