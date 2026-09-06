import { z } from "zod";

export const cameraSchema = z.object({
  name: z.string().trim().min(1, "Camera name is required.").max(120, "Camera name must be 120 characters or fewer."),
  rtspUrl: z.string().trim().url("Enter a valid stream URL."),
  location: z.string().trim().max(160, "Location must be 160 characters or fewer.").default(""),
  enabled: z.boolean().default(true)
});

export function formatValidationErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".") || "body";
    fields[field] ??= issue.message;
  }

  return {
    error: "Please correct the highlighted fields.",
    fields
  };
}
