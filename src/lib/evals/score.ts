import type { Check } from '@/lib/schemas';
import type { ExpectedFinding, Fixture } from './fixtures';

export type EvalResult = {
  fixtureId: string;
  passed: boolean;
  recall: number; // expected findings caught / expected findings total
  hallucination: boolean; // true if expectClean fixture produced any fail
  matched: ExpectedFinding[];
  missed: ExpectedFinding[];
  unexpectedFails: Check[];
  totalChecks: number;
};

export function scoreFixture(fixture: Fixture, checks: Check[]): EvalResult {
  const matched: ExpectedFinding[] = [];
  const missed: ExpectedFinding[] = [];

  for (const exp of fixture.expectedFindings) {
    const needle = exp.keyword.toLowerCase();
    const hit = checks.some((c) => {
      if (c.category !== exp.category) return false;
      const haystack = [
        c.name,
        c.explanation,
        c.recommendation ?? '',
        ...(c.fileReferences?.map((r) => r.path) ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
    (hit ? matched : missed).push(exp);
  }

  const fails = checks.filter((c) => c.status === 'fail');
  const hallucination = !!fixture.expectClean && fails.length > 0;

  const recall = fixture.expectedFindings.length
    ? matched.length / fixture.expectedFindings.length
    : 1;
  const passed = recall === 1 && !hallucination;

  return {
    fixtureId: fixture.id,
    passed,
    recall,
    hallucination,
    matched,
    missed,
    unexpectedFails: hallucination ? fails : [],
    totalChecks: checks.length,
  };
}
