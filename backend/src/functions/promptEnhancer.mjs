import { query } from '../db.mjs';
import { uuid } from '../auth.mjs';
import { debitCreditsForUser, refundCreditsForUser, hasRole } from '../rpc.mjs';

const WAVESPEED_LLM_BASE = 'https://llm.wavespeed.ai/v1';

const DEFAULT_RATES = {
  'qwen/qwen3.7-flash': { input: 0.03, output: 0.13 },
  'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
};

const CONFIG_KEYS = [
  'prompt_enhancer_enabled',
  'prompt_enhancer_monthly_budget_usd',
  'prompt_enhancer_stop_at_budget',
  'prompt_enhancer_daily_user_limit',
  'prompt_enhancer_charge_enabled',
  'prompt_enhancer_charge_credits',
  'prompt_enhancer_free_daily',
  'prompt_enhancer_admin_free',
  'prompt_enhancer_primary_model',
  'prompt_enhancer_fallback_model',
  'prompt_enhancer_model_rates',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no configurado`);
  return value;
}

function requireUser(auth) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  return auth.user;
}

function requireAdmin(auth) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
}

function numberValue(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function boolValue(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

export async function getPromptEnhancerConfig() {
  const result = await query('select key,value from app_settings where key=any($1::text[])', [CONFIG_KEYS]);
  const settings = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  const rates = settings.prompt_enhancer_model_rates && typeof settings.prompt_enhancer_model_rates === 'object'
    ? { ...DEFAULT_RATES, ...settings.prompt_enhancer_model_rates }
    : DEFAULT_RATES;

  return {
    enabled: boolValue(settings.prompt_enhancer_enabled, true),
    monthlyBudgetUsd: numberValue(settings.prompt_enhancer_monthly_budget_usd, 5, 0, 100000),
    stopAtBudget: boolValue(settings.prompt_enhancer_stop_at_budget, true),
    dailyUserLimit: Math.round(numberValue(settings.prompt_enhancer_daily_user_limit, 50, 0, 100000)),
    chargeEnabled: boolValue(settings.prompt_enhancer_charge_enabled, false),
    chargeCredits: Math.round(numberValue(settings.prompt_enhancer_charge_credits, 1, 0, 100000)),
    freeDaily: Math.round(numberValue(settings.prompt_enhancer_free_daily, 3, 0, 100000)),
    adminFree: boolValue(settings.prompt_enhancer_admin_free, true),
    primaryModel: String(settings.prompt_enhancer_primary_model || 'qwen/qwen3.7-flash'),
    fallbackModel: String(settings.prompt_enhancer_fallback_model || 'google/gemini-2.5-flash'),
    modelRates: rates,
  };
}

async function successfulUsageLast24h(userId) {
  const result = await query(
    `select count(*)::int as count
       from prompt_enhancer_usage
      where user_id=$1 and status='success' and created_at >= now()-interval '24 hours'`,
    [userId],
  );
  return Number(result.rows[0]?.count || 0);
}

async function monthSpendUsd() {
  const result = await query(
    `select coalesce(sum(cost_usd),0)::numeric as cost
       from prompt_enhancer_usage
      where status='success' and created_at >= date_trunc('month', now())`,
  );
  return Number(result.rows[0]?.cost || 0);
}

async function chargeForUser(userId, auth, config) {
  const used24h = await successfulUsageLast24h(userId);
  const isAdmin = auth?.isAdmin || await hasRole(userId, 'admin');
  const chargeApplies = config.chargeEnabled && !(isAdmin && config.adminFree);
  const chargedCredits = chargeApplies && used24h >= config.freeDaily ? config.chargeCredits : 0;

  return {
    used24h,
    isAdmin,
    chargedCredits,
    freeRemaining: chargeApplies ? Math.max(0, config.freeDaily - used24h) : 0,
    dailyRemaining: config.dailyUserLimit > 0 ? Math.max(0, config.dailyUserLimit - used24h) : null,
  };
}

function rateForModel(config, model) {
  const rate = config.modelRates?.[model] || DEFAULT_RATES[model] || { input: 0, output: 0 };
  return {
    input: numberValue(rate?.input, 0, 0, 1000),
    output: numberValue(rate?.output, 0, 0, 1000),
  };
}

function tokenUsage(data, inputText, outputText) {
  const usage = data?.usage || {};
  const reportedInput = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const reportedOutput = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const hasReported = reportedInput > 0 || reportedOutput > 0;
  const inputTokens = hasReported ? reportedInput : Math.max(1, Math.ceil(String(inputText || '').length / 4));
  const outputTokens = hasReported ? reportedOutput : Math.max(1, Math.ceil(String(outputText || '').length / 4));
  return {
    inputTokens,
    outputTokens,
    totalTokens: Number(usage.total_tokens || inputTokens + outputTokens),
    tokenSource: hasReported ? 'reported' : 'estimated',
  };
}

function estimateCostUsd(tokens, rate) {
  return (tokens.inputTokens / 1_000_000) * rate.input + (tokens.outputTokens / 1_000_000) * rate.output;
}

async function recordUsage({
  userId,
  model,
  tokens = {},
  costUsd = 0,
  chargedCredits = 0,
  usedFallback = false,
  status,
  error = null,
}) {
  await query(
    `insert into prompt_enhancer_usage
      (id,user_id,model,input_tokens,output_tokens,total_tokens,token_source,cost_usd,charged_credits,used_fallback,status,error)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      uuid(),
      userId,
      model || 'unknown',
      Number(tokens.inputTokens || 0),
      Number(tokens.outputTokens || 0),
      Number(tokens.totalTokens || 0),
      tokens.tokenSource || 'unknown',
      Number(costUsd || 0),
      Number(chargedCredits || 0),
      Boolean(usedFallback),
      status,
      error ? String(error).slice(0, 1000) : null,
    ],
  );
}

export async function promptEnhancerQuote(auth) {
  const user = requireUser(auth);
  const config = await getPromptEnhancerConfig();
  const [spend, charge] = await Promise.all([
    monthSpendUsd(),
    chargeForUser(user.id, auth, config),
  ]);
  const budgetReached = config.monthlyBudgetUsd > 0 && spend >= config.monthlyBudgetUsd;
  const dailyLimitReached = config.dailyUserLimit > 0 && charge.used24h >= config.dailyUserLimit;

  return {
    code: 0,
    data: {
      enabled: config.enabled && !(config.stopAtBudget && budgetReached) && !dailyLimitReached,
      chargedCredits: charge.chargedCredits,
      freeRemaining: charge.freeRemaining,
      dailyRemaining: charge.dailyRemaining,
      budgetReached: config.stopAtBudget && budgetReached,
      dailyLimitReached,
    },
  };
}

export async function improvePrompt(body, auth) {
  const user = requireUser(auth);
  if (body?.action === 'quote') return promptEnhancerQuote(auth);

  const apiKey = requireEnv('WAVESPEED_API_KEY');
  const prompt = String(body?.prompt || '').trim();
  const modelName = String(body?.model_name || body?.model_id || 'AI model').slice(0, 160);
  const modelType = String(body?.model_type || '').slice(0, 80);
  if (prompt.length < 3) throw Object.assign(new Error('Prompt demasiado corto'), { status: 400 });
  if (prompt.length > 3000) throw Object.assign(new Error('Prompt demasiado largo'), { status: 400 });

  const config = await getPromptEnhancerConfig();
  if (!config.enabled) return { code: 4, message: 'El mejorador de prompts está desactivado.' };

  const [spend, charge] = await Promise.all([
    monthSpendUsd(),
    chargeForUser(user.id, auth, config),
  ]);

  if (config.stopAtBudget && config.monthlyBudgetUsd > 0 && spend >= config.monthlyBudgetUsd) {
    return { code: 4, message: 'El mejorador alcanzó su presupuesto mensual.' };
  }
  if (config.dailyUserLimit > 0 && charge.used24h >= config.dailyUserLimit) {
    return { code: 5, message: 'Alcanzaste el límite de mejoras de las últimas 24 horas.' };
  }

  let prepaid = false;
  if (charge.chargedCredits > 0) {
    try {
      await debitCreditsForUser(user.id, charge.chargedCredits, 'Mejorador de prompt');
      prepaid = true;
    } catch (error) {
      if (String(error?.message || error).includes('insufficient_credits')) {
        return { code: 2, message: `Saldo insuficiente. Necesitás ${charge.chargedCredits} créditos para mejorar el prompt.` };
      }
      throw error;
    }
  }

  const refundIfNeeded = async () => {
    if (!prepaid || charge.chargedCredits <= 0) return;
    await refundCreditsForUser(user.id, charge.chargedCredits, 'Reembolso: mejorador de prompt').catch((error) => {
      console.error('[prompt-enhancer-refund]', error);
    });
    prepaid = false;
  };

  const system = [
    'You are an expert prompt editor for generative image, video, avatar and audio models.',
    'Rewrite the user prompt to produce a stronger result for the selected model.',
    'Preserve the user intent, language, named subjects and important constraints.',
    'Add useful concrete detail about subject, environment, composition, camera, lighting, movement, style and quality only when relevant.',
    'For video, describe motion, camera movement, timing and continuity. For image, prioritize composition, lighting, materials and visual detail.',
    'Do not add safety disclaimers, explanations, headings, quotation marks or metadata.',
    'Return only the improved prompt, ready to paste into the generation model.',
  ].join(' ');

  const userContent = [
    `Selected model: ${modelName}`,
    `Model type: ${modelType || 'unknown'}`,
    'Original prompt:',
    prompt,
  ].join('\n');

  const candidates = [...new Set([config.primaryModel, config.fallbackModel].filter(Boolean))];
  let lastError = null;
  let lastModel = candidates[0] || 'unknown';

  for (let index = 0; index < candidates.length; index++) {
    const model = candidates[index];
    lastModel = model;
    try {
      const res = await fetch(`${WAVESPEED_LLM_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
          temperature: 0.65,
          max_tokens: 700,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = new Error(data?.error?.message || data?.message || `LLM HTTP ${res.status}`);
        continue;
      }

      const improved = String(data?.choices?.[0]?.message?.content || '').trim();
      if (!improved) {
        lastError = new Error('LLM returned empty prompt');
        continue;
      }

      const tokens = tokenUsage(data, `${system}\n${userContent}`, improved);
      const costUsd = estimateCostUsd(tokens, rateForModel(config, model));
      await recordUsage({
        userId: user.id,
        model,
        tokens,
        costUsd,
        chargedCredits: charge.chargedCredits,
        usedFallback: index > 0,
        status: 'success',
      }).catch((error) => console.error('[prompt-enhancer-usage]', error));

      return {
        code: 0,
        data: {
          prompt: improved,
          model,
          chargedCredits: charge.chargedCredits,
          freeRemaining: Math.max(0, charge.freeRemaining - (charge.chargedCredits === 0 && config.chargeEnabled ? 1 : 0)),
        },
      };
    } catch (error) {
      lastError = error;
    }
  }

  await refundIfNeeded();
  await recordUsage({
    userId: user.id,
    model: lastModel,
    chargedCredits: 0,
    usedFallback: candidates.length > 1,
    status: 'failed',
    error: lastError instanceof Error ? lastError.message : String(lastError || 'unknown'),
  }).catch((error) => console.error('[prompt-enhancer-usage]', error));

  console.error('[improve-prompt]', lastError);
  return { code: 1, message: 'No se pudo mejorar el prompt en este momento.' };
}

function cleanConfig(input = {}) {
  const primaryModel = String(input.primaryModel || 'qwen/qwen3.7-flash').trim();
  const fallbackModel = String(input.fallbackModel || 'google/gemini-2.5-flash').trim();
  if (!primaryModel) throw Object.assign(new Error('Modelo principal requerido'), { status: 400 });

  const rawRates = input.modelRates && typeof input.modelRates === 'object' ? input.modelRates : {};
  const modelRates = {};
  for (const model of new Set([primaryModel, fallbackModel].filter(Boolean))) {
    const defaults = DEFAULT_RATES[model] || { input: 0, output: 0 };
    const rate = rawRates[model] || defaults;
    modelRates[model] = {
      input: numberValue(rate?.input, defaults.input, 0, 1000),
      output: numberValue(rate?.output, defaults.output, 0, 1000),
    };
  }

  return {
    enabled: input.enabled !== false,
    monthlyBudgetUsd: numberValue(input.monthlyBudgetUsd, 5, 0, 100000),
    stopAtBudget: input.stopAtBudget !== false,
    dailyUserLimit: Math.round(numberValue(input.dailyUserLimit, 50, 0, 100000)),
    chargeEnabled: input.chargeEnabled === true,
    chargeCredits: Math.round(numberValue(input.chargeCredits, 1, 0, 100000)),
    freeDaily: Math.round(numberValue(input.freeDaily, 3, 0, 100000)),
    adminFree: input.adminFree !== false,
    primaryModel,
    fallbackModel,
    modelRates,
  };
}

async function saveConfig(config) {
  const rows = [
    ['prompt_enhancer_enabled', config.enabled],
    ['prompt_enhancer_monthly_budget_usd', config.monthlyBudgetUsd],
    ['prompt_enhancer_stop_at_budget', config.stopAtBudget],
    ['prompt_enhancer_daily_user_limit', config.dailyUserLimit],
    ['prompt_enhancer_charge_enabled', config.chargeEnabled],
    ['prompt_enhancer_charge_credits', config.chargeCredits],
    ['prompt_enhancer_free_daily', config.freeDaily],
    ['prompt_enhancer_admin_free', config.adminFree],
    ['prompt_enhancer_primary_model', config.primaryModel],
    ['prompt_enhancer_fallback_model', config.fallbackModel],
    ['prompt_enhancer_model_rates', config.modelRates],
  ];

  for (const [key, value] of rows) {
    await query(
      `insert into app_settings(key,value,updated_at) values ($1,$2::jsonb,now())
       on conflict(key) do update set value=excluded.value,updated_at=now()`,
      [key, JSON.stringify(value)],
    );
  }
}

async function adminMetrics(config) {
  const [summaryResult, modelsResult, usersResult] = await Promise.all([
    query(`
      select
        count(*) filter (where status='success')::int as total_success,
        count(*) filter (where status='success' and created_at >= now()-interval '24 hours')::int as success_24h,
        count(*) filter (where status='success' and created_at >= date_trunc('month',now()))::int as success_month,
        coalesce(sum(cost_usd) filter (where status='success'),0)::numeric as cost_total,
        coalesce(sum(cost_usd) filter (where status='success' and created_at >= now()-interval '24 hours'),0)::numeric as cost_24h,
        coalesce(sum(cost_usd) filter (where status='success' and created_at >= date_trunc('month',now())),0)::numeric as cost_month,
        coalesce(avg(cost_usd) filter (where status='success' and created_at >= date_trunc('month',now())),0)::numeric as avg_cost_month,
        coalesce(sum(charged_credits) filter (where status='success' and created_at >= date_trunc('month',now())),0)::int as charged_credits_month,
        count(*) filter (where status='failed' and created_at >= date_trunc('month',now()))::int as failures_month,
        count(*) filter (where used_fallback=true and status='success' and created_at >= date_trunc('month',now()))::int as fallback_month
      from prompt_enhancer_usage
    `),
    query(`
      select model,
             count(*)::int as uses,
             coalesce(sum(cost_usd),0)::numeric as cost_usd,
             coalesce(sum(input_tokens),0)::bigint as input_tokens,
             coalesce(sum(output_tokens),0)::bigint as output_tokens
        from prompt_enhancer_usage
       where status='success' and created_at >= date_trunc('month',now())
       group by model
       order by uses desc
    `),
    query(`
      select u.user_id,
             coalesce(p.email,'') as email,
             coalesce(p.display_name,'') as display_name,
             count(*)::int as uses,
             coalesce(sum(u.cost_usd),0)::numeric as cost_usd,
             coalesce(sum(u.charged_credits),0)::int as charged_credits
        from prompt_enhancer_usage u
        left join profiles p on p.id=u.user_id
       where u.status='success' and u.created_at >= date_trunc('month',now())
       group by u.user_id,p.email,p.display_name
       order by uses desc
       limit 10
    `),
  ]);

  const summary = summaryResult.rows[0] || {};
  const costMonth = Number(summary.cost_month || 0);
  const budget = Number(config.monthlyBudgetUsd || 0);

  return {
    summary: {
      totalSuccess: Number(summary.total_success || 0),
      success24h: Number(summary.success_24h || 0),
      successMonth: Number(summary.success_month || 0),
      costTotal: Number(summary.cost_total || 0),
      cost24h: Number(summary.cost_24h || 0),
      costMonth,
      avgCostMonth: Number(summary.avg_cost_month || 0),
      chargedCreditsMonth: Number(summary.charged_credits_month || 0),
      failuresMonth: Number(summary.failures_month || 0),
      fallbackMonth: Number(summary.fallback_month || 0),
      budgetPct: budget > 0 ? Math.min(999, (costMonth / budget) * 100) : 0,
    },
    models: modelsResult.rows.map((row) => ({
      model: row.model,
      uses: Number(row.uses || 0),
      costUsd: Number(row.cost_usd || 0),
      inputTokens: Number(row.input_tokens || 0),
      outputTokens: Number(row.output_tokens || 0),
    })),
    users: usersResult.rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      uses: Number(row.uses || 0),
      costUsd: Number(row.cost_usd || 0),
      chargedCredits: Number(row.charged_credits || 0),
    })),
  };
}

export async function promptEnhancerAdmin(body, auth) {
  requireAdmin(auth);
  const action = String(body?.action || 'get');

  if (action === 'save') {
    const config = cleanConfig(body?.config || {});
    await saveConfig(config);
    return { code: 0, data: { config, metrics: await adminMetrics(config) } };
  }

  const config = await getPromptEnhancerConfig();
  return { code: 0, data: { config, metrics: await adminMetrics(config) } };
}
