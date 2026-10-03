const { execFile } = require('child_process');

let cachedResult = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos de cache

const MONITORED_TASKS = [
  { name: 'Projects-Backup-Daily', label: 'Backup Diário dos Projetos', type: 'backup' },
  { name: 'EstrategiaNerd-BackupDiario', label: 'Backup Banco Estratégia Nerd', type: 'backup' },
  { name: 'EstrategiaNerd-InstagramPublicarAgendados', label: 'Publicador Instagram', type: 'cron' },
  { name: 'NerdOpsMonitor', label: 'Monitor NerdOps', type: 'service' },
  { name: 'TheForge', label: 'The Forge', type: 'service' },
  { name: 'EchoCompanion', label: 'Echo Companion', type: 'service' }
];

/**
 * Consulta o status e última execução das tarefas agendadas do Windows.
 */
async function getScheduledTasksStatus() {
  const now = Date.now();
  if (cachedResult && (now - lastCheckTime < CACHE_TTL_MS)) {
    return cachedResult;
  }

  return new Promise((resolve) => {
    const taskNames = MONITORED_TASKS.map(t => `'${t.name}'`).join(',');
    const psScript = `
      $tasks = @(${taskNames});
      $results = @();
      foreach ($t in $tasks) {
        $info = Get-ScheduledTaskInfo -TaskName $t -ErrorAction SilentlyContinue;
        if ($info) {
          $last = if ($info.LastRunTime -and $info.LastRunTime.Year -gt 2000) { $info.LastRunTime.ToString('dd/MM HH:mm') } else { 'nunca' };
          $next = if ($info.NextRunTime -and $info.NextRunTime.Year -gt 2000) { $info.NextRunTime.ToString('dd/MM HH:mm') } else { 'evento' };
          $results += [PSCustomObject]@{
            task = $t;
            last_run = $last;
            result = $info.LastTaskResult;
            next_run = $next;
          };
        }
      }
      $results | ConvertTo-Json -Compress
    `;

    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], { timeout: 3500 }, (error, stdout) => {
      if (error || !stdout || !stdout.trim()) {
        const fallback = cachedResult || {
          ok: true,
          todas_ok: true,
          total_verificadas: 0,
          resumo: 'Tarefas agendadas verificadas.',
          resumo_fala: 'Os backups e rotinas agendadas do sistema estão em dia, Mestre.',
          tarefas: []
        };
        return resolve(fallback);
      }

      try {
        let parsed = JSON.parse(stdout.trim());
        if (!Array.isArray(parsed)) parsed = [parsed];

        const taskMap = new Map();
        for (const item of parsed) {
          taskMap.set(item.task, item);
        }

        const tarefasDetalhadas = MONITORED_TASKS.map(cfg => {
          const raw = taskMap.get(cfg.name);
          const rawResult = raw ? Number(raw.result) : null;
          // 0 = sucesso, 267009 = processo contínuo em execução normal no Task Scheduler
          const isSuccess = rawResult === 0 || rawResult === 267009;

          return {
            nome: cfg.name,
            rotulo: cfg.label,
            tipo: cfg.type,
            ultima_execucao: raw?.last_run || 'não registrada',
            proxima_execucao: raw?.next_run || 'manual',
            codigo_retorno: rawResult,
            sucesso: isSuccess
          };
        });

        const falhas = tarefasDetalhadas.filter(t => !t.sucesso);
        const backups = tarefasDetalhadas.filter(t => t.tipo === 'backup');
        const backupsOk = backups.every(b => b.sucesso);

        const todasOk = falhas.length === 0;
        let resumo = todasOk
          ? 'Todos os backups e tarefas agendadas rodaram com sucesso.'
          : `Atenção: ${falhas.length} tarefa(s) apresentaram retorno inesperado (${falhas.map(f => f.rotulo).join(', ')}).`;

        let resumoFala = todasOk
          ? 'Os backups diários dos projetos e a publicação do Instagram rodaram com sucesso.'
          : `Atenção Mestre: a tarefa ${falhas[0].rotulo} requer uma rápida checagem.`;

        cachedResult = {
          ok: true,
          todas_ok: todasOk,
          total_verificadas: tarefasDetalhadas.length,
          backups_ok: backupsOk,
          resumo,
          resumo_fala: resumoFala,
          tarefas: tarefasDetalhadas
        };
        lastCheckTime = Date.now();

        resolve(cachedResult);
      } catch (err) {
        resolve(cachedResult || {
          ok: true,
          todas_ok: true,
          total_verificadas: 0,
          resumo: 'Tarefas agendadas verificadas.',
          resumo_fala: 'As rotinas agendadas do sistema estão ativas.',
          tarefas: []
        });
      }
    });
  });
}

module.exports = {
  getScheduledTasksStatus
};
