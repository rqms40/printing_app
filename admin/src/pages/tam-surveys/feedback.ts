export type TamSurveyFeedbackKey =
  | "price_value"
  | "upload_friction"
  | "feature"
  | "delivery";

export const TAM_SURVEY_FEEDBACK_FIELDS: ReadonlyArray<{
  key: TamSurveyFeedbackKey;
  label: string;
}> = [
  {
    key: "price_value",
    label: "WOULD THEY PAY THE ORDER PRICE FOR THE CONVENIENCE?",
  },
  {
    key: "upload_friction",
    label: "WHERE DID THE UPLOAD PROCESS CREATE FRICTION?",
  },
  {
    key: "feature",
    label: "WHAT IS ONE FEATURE OR SERVICE YOU WISH GRIDGO WOULD ADD?",
  },
  {
    key: "delivery",
    label: "ANY ADDITIONAL COMMENTS REGARDING YOUR EXPERIENCE?",
  },
];

export type TamSurveyFeedback = Partial<Record<TamSurveyFeedbackKey, string>>;

export function parseTamSurveyFeedback(value: unknown): TamSurveyFeedback {
  if (!value) return {};

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { feature: value };
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const source = parsed as Record<string, unknown>;
  return Object.fromEntries(
    TAM_SURVEY_FEEDBACK_FIELDS.flatMap(({ key }) => {
      const answer = source[key];
      return typeof answer === "string" && answer.trim()
        ? [[key, answer]]
        : [];
    }),
  ) as TamSurveyFeedback;
}

export function summarizeTamSurveyFeedback(value: unknown): string {
  const feedback = parseTamSurveyFeedback(value);
  return TAM_SURVEY_FEEDBACK_FIELDS.flatMap(({ key }) =>
    feedback[key] ? [feedback[key]] : [],
  ).join(" | ");
}
