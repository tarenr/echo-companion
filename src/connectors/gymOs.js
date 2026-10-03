const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const GYM_DB_PATH = process.env.GYM_OS_DB_PATH || 'C:/Users/WINDOWS/Projects/GYM-OS/data/gym-os.sqlite';

/**
 * Retorna os detalhes de treino do dia, streak e nível do Gym OS
 */
function getWorkoutAndStreak() {
  return new Promise((resolve) => {
    if (!fs.existsSync(GYM_DB_PATH)) {
      return resolve({
        ok: false,
        erro: `Banco de dados do Gym OS não encontrado em ${GYM_DB_PATH}`
      });
    }

    const db = new sqlite3.Database(GYM_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return resolve({
          ok: false,
          erro: `Erro ao abrir banco do Gym OS: ${err.message}`
        });
      }
    });

    const today = new Date();
    const dayIndex = today.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    db.get(
      'SELECT day_index, day_of_week, mission_name, intensity, bonus_xp, rest_day FROM daily_missions WHERE day_index = ?',
      [dayIndex],
      (err, mission) => {
        if (err) {
          db.close();
          return resolve({ ok: false, erro: err.message });
        }

        db.all(
          'SELECT date, workout_name, xp FROM workouts ORDER BY date DESC',
          [],
          (err2, workouts) => {
            db.close();
            if (err2) {
              return resolve({ ok: false, erro: err2.message });
            }

            const allWorkouts = workouts || [];
            let totalXp = 0;

            for (const w of allWorkouts) {
              try {
                if (w.xp) {
                  const xpObj = JSON.parse(w.xp);
                  totalXp += Number(xpObj.total || xpObj.execution || 0);
                }
              } catch (_) {}
            }

            // Nível: base de 1000 XP por nível
            const nivel = Math.floor(totalXp / 1000) + 1;
            const xpRestanteParaProximoNivel = 1000 - (totalXp % 1000);

            // Último treino registrado
            const ultimo = allWorkouts.length > 0 ? allWorkouts[0] : null;
            let ultimoTreinoInfo = null;
            if (ultimo) {
              let xpGanho = 0;
              try {
                const parsed = JSON.parse(ultimo.xp || '{}');
                xpGanho = parsed.total || 0;
              } catch (_) {}

              ultimoTreinoInfo = {
                data: ultimo.date ? String(ultimo.date).substring(0, 10) : 'Sem data',
                nome: ultimo.workout_name,
                xp_ganho: xpGanho
              };
            }

            // Streak simples baseado em datas únicas de treino
            const uniqueDates = Array.from(new Set(allWorkouts.map(w => String(w.date).substring(0, 10))));
            const streakDias = uniqueDates.length;

            resolve({
              ok: true,
              hoje: {
                dia_semana: dayNames[dayIndex],
                missao: mission ? mission.mission_name : 'Treino Livre',
                dia_descanso: mission ? Boolean(mission.rest_day) : false,
                intensidade: mission ? mission.intensity : 'Normal',
                bonus_xp: mission ? mission.bonus_xp : 0
              },
              ultimo_treino: ultimoTreinoInfo,
              gamificacao: {
                nivel,
                total_xp: totalXp,
                xp_para_proximo_nivel: xpRestanteParaProximoNivel,
                total_treinos_registrados: allWorkouts.length,
                streak_dias_treinados: streakDias
              }
            });
          }
        );
      }
    );
  });
}

module.exports = {
  getWorkoutAndStreak
};
