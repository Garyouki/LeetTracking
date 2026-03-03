export interface SRSState {
  repetitions: number;
  interval_days: number;
  easiness_factor: number;
  last_reviewed_at: string;
  next_due_at: string;
}

export function calculateNext(
  state: SRSState | null,
  rating: 'Again' | 'Hard' | 'Good' | 'Easy',
  difficulty: 'Easy' | 'Medium' | 'Hard',
): SRSState {
  const now = new Date().toISOString();

  let ef = state?.easiness_factor ?? 2.5;
  let interval = state?.interval_days ?? 0;
  let reps = state?.repetitions ?? 0;

  // Difficulty modifiers
  const efModifier = {
    Easy: 1.2,
    Medium: 1.0,
    Hard: 0.8,
  }[difficulty];

  // Quality mapping (SM-2 style)
  const quality = {
    Again: 2,
    Hard: 3,
    Good: 4,
    Easy: 5,
  }[rating];

  if (quality < 3) {
    interval = 1;
    reps = 0;
  } else {
    if (reps === 0) {
      interval = difficulty === 'Hard' ? 1 : 2;
    } else if (reps === 1) {
      interval = difficulty === 'Hard' ? 3 : 6;
    } else {
      interval = Math.round(interval * ef * efModifier);
      if (interval < 1) interval = 1;
    }
    reps += 1;
  }

  // Update easiness factor
  ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  // Next due date
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + interval);

  return {
    repetitions: reps,
    interval_days: interval,
    easiness_factor: ef,
    last_reviewed_at: now,
    next_due_at: nextDue.toISOString(),
  };
}
