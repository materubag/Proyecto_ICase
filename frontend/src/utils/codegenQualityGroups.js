export function groupQualityIssues(errors = []) {
  const groups = new Map();
  const totals = { operations: 0, screens: 0, requirements: 0, other: 0 };
  for (const issue of errors) {
    const category = issue.code === 'UNRESOLVED_OPERATION_CONTRACT' ? 'operations'
      : issue.code === 'UNRESOLVED_SCREEN_CONTRACT' ? 'screens'
        : issue.code === 'UNIMPLEMENTED_REQUIREMENT_BEHAVIOR' ? 'requirements' : 'other';
    totals[category]++;
    const key = category + ':' + (issue.element || issue.code || 'General');
    if (!groups.has(key)) groups.set(key, { key, category, element: issue.element || 'General', issues: [] });
    groups.get(key).issues.push(issue);
  }
  const counts = Object.fromEntries(Object.keys(totals).map(category => [category, [...groups.values()].filter(group => group.category === category).length]));
  return { groups: [...groups.values()], totals, counts, total: errors.length };
}

export function completedBatchAnswers(questions, selectedOptions = {}, customAnswers = {}) {
  return (questions || []).flatMap(question => {
    const customAnswer = String(customAnswers[question.questionId] || '').trim();
    const selected = question.options?.find(option => option.id === selectedOptions[question.questionId]);
    return customAnswer || selected ? [{ questionId: question.questionId, customAnswer: customAnswer || undefined,
      selectedOptionId: selected?.id, requirementIds: question.requirementIds || [] }] : [];
  });
}
export function diagnosticText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(diagnosticText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    const label = diagnosticText(value.item);
    const reason = diagnosticText(value.reason ?? value.message ?? value.description ?? value.question);
    return [label, reason].filter(Boolean).join(': ') || JSON.stringify(value);
  }
  return String(value);
}

