import { z } from "zod";

export const ChatTurn = z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) });
export type ChatTurn = z.infer<typeof ChatTurn>;

export const ChatRequest = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(ChatTurn).max(20),
});
export const ChatReply = z.object({ reply: z.string() });
