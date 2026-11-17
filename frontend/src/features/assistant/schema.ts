import { z } from "zod";

/**
 * The students' assistant (the AI team's part): a question in Arabic or English, an answer in
 * the same language with the university documents it came from. The server keeps no chat
 * history; the app sends the last few turns so a follow-up question makes sense.
 */
export const ASSISTANT_QUESTION_MAX_LENGTH = 500;
/** How many earlier turns the app sends with a question. */
export const ASSISTANT_HISTORY_TURNS = 6;

export const AssistantRole = { User: "user", Assistant: "assistant" } as const;
export type AssistantRole = (typeof AssistantRole)[keyof typeof AssistantRole];

const turnSchema = z.object({
  role: z.enum([AssistantRole.User, AssistantRole.Assistant]),
  text: z.string().max(4000),
});

export const askBodySchema = z.object({
  question: z.string().trim().min(1).max(ASSISTANT_QUESTION_MAX_LENGTH),
  history: z.array(turnSchema).max(ASSISTANT_HISTORY_TURNS),
});
export type AskBody = z.infer<typeof askBodySchema>;

export const assistantAnswerSchema = z.object({
  /** Plain text in the question's language. */
  answer: z.string(),
  /** The documents the answer is based on (e.g. "Code of Conduct, clause 4"). */
  sources: z.array(z.string()),
  /** The assistant isn't sure: the app shows the Transportation office's number. */
  needs_office: z.boolean(),
});
export type AssistantAnswer = z.infer<typeof assistantAnswerSchema>;
