function record(usage, { model, stage, rates } = {}) {
  const inputTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? null;
  const outputTokens = usage?.completion_tokens ?? usage?.output_tokens ?? null;
  const inputRate = rates?.input ?? process.env.ANALYSIS_INPUT_USD_PER_MILLION;
  const outputRate = rates?.output ?? process.env.ANALYSIS_OUTPUT_USD_PER_MILLION;
  const priced = inputRate != null && outputRate != null && inputRate !== '' && outputRate !== '' &&
    [Number(inputRate), Number(outputRate)].every(n => Number.isFinite(n) && n >= 0);
  return { ...usage, model, stage, inputTokens, outputTokens,
    estimatedCostUsd: priced && inputTokens != null && outputTokens != null ? (inputTokens * Number(inputRate) + outputTokens * Number(outputRate)) / 1000000 : null };
}
module.exports = { record };
