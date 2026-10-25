const READ_TOOLS = Object.freeze([
  'consultar_projetos_forge', 'consultar_tarefas_forge', 'consultar_status_backup_forge',
  'consultar_monitor_servicos', 'consultar_dashboard_pc', 'consultar_agendamento_posts',
  'consultar_metricas_blog', 'consultar_metricas_instagram'
]);

function createToolPolicy(declarations) {
  const allowed = new Map(declarations.filter(d => READ_TOOLS.includes(d.name)).map(d => [d.name, d]));
  return {
    declarations: [...allowed.values()],
    validate(name, args) {
      const declaration = allowed.get(name);
      const refusal = { ok: false, erro: 'Ferramenta ou argumentos não permitidos nesta consulta.' };
      if (!declaration || !args || typeof args !== 'object' || Array.isArray(args)) return refusal;
      const schema = declaration.parameters;
      const properties = schema?.properties || {};
      if ((schema?.required || []).some(key => !Object.hasOwn(args, key))) return refusal;
      const normalized = {};
      for (const key of Object.keys(args).sort()) {
        if (!Object.hasOwn(properties, key)) return refusal;
        const spec = properties[key], value = args[key];
        if (spec.type === 'STRING' && (typeof value !== 'string' || value.length > 500)) return refusal;
        if (spec.type === 'BOOLEAN' && typeof value !== 'boolean') return refusal;
        if (!['STRING', 'BOOLEAN'].includes(spec.type) || (spec.enum && !spec.enum.includes(value))) return refusal;
        normalized[key] = value;
      }
      return { ok: true, args: normalized, key: `${name}:${JSON.stringify(normalized)}` };
    }
  };
}
module.exports = { createToolPolicy, READ_TOOLS };
