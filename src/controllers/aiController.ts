import { Request, Response } from 'express';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';
import { AppError } from '@errors/AppError';
import { env } from '@config/env';

interface KayaAiResponse {
  message: string;
  intent: string;
  success: boolean;
  clarificationRequested?: boolean;
}

export const aiController = {
  conversation: asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body as { message?: string };
    if (!message) {
      throw new AppError('A message is required.', 400);
    }

    const userId = req.user?.id ?? 'anonymous';
    const businessId = req.user?.businessId;

    if (!businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await fetch(`${env.KAYA_AI_URL}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, businessId, userId }),
        });

        if (!result.ok) {
          throw new Error(`Kaya AI request failed with status ${result.status}`);
        }

        const aiResponse = (await result.json()) as KayaAiResponse;

        return ApiResponse.success(res, {
          message: 'AI response generated successfully.',
          data: {
            reply: aiResponse.message ?? 'No response returned.',
            provider: 'kaya-ai',
            raw: aiResponse,
          },
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw new AppError(`AI integration failed after retries: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`, 502);
  }),
};
