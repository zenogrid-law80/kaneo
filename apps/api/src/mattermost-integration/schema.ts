import { integrationEventToggles } from "../integrations/schema";
import { z } from "../openapi";

const mattermostEventToggles = integrationEventToggles.extend({
  bugCreated: z.boolean().optional(),
  bugAssigneesChanged: z.boolean().optional(),
});

export const createMattermostBody = z.object({
  webhookUrl: z.string().min(1),
  channelName: z.string().optional(),
  events: mattermostEventToggles.optional(),
});

export const updateMattermostBody = z.object({
  webhookUrl: z.string().optional(),
  channelName: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  events: mattermostEventToggles.optional(),
});
