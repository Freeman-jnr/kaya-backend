import { Request, Response } from 'express';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';
import { AppError } from '@errors/AppError';
import { env } from '@config/env';
import { prisma } from '@integrations/prisma/client';

interface DifyPayload {
  inputs: Record<string, unknown>;
  query: string;
  response_mode: 'streaming' | 'blocking';
  user: string;
}

interface DifyResponse {
  answer?: string;
  text?: string;
  [key: string]: unknown;
}

async function callDify(message: string, userId: string, context: Record<string, unknown>): Promise<DifyResponse> {
  const payload: DifyPayload = {
    inputs: context,
    query: message,
    response_mode: 'blocking',
    user: userId,
  };

  const url = env.DIFY_API_URL || 'https://api.dify.ai/v1/chat-messages';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DIFY_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Dify request failed with status ${response.status}`);
  }

  return (await response.json()) as DifyResponse;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatMoney(amount: number): string {
  return `₦${Math.round(amount).toLocaleString()}`;
}

/**
 * Local assistant used when Dify is not wired up (no API key). It answers
 * common business questions directly from the live database so the AI
 * surface always works against real data instead of failing.
 */
async function generateLocalReply(message: string, businessId: string): Promise<string> {
  const lower = message.toLowerCase();

  if (lower.includes('owe') || lower.includes('outstanding') || lower.includes('balance') || lower.includes('debt')) {
    const debtors = await prisma.customer.findMany({
      where: { businessId, outstanding: { gt: 0 } },
      orderBy: { outstanding: 'desc' },
    });
    if (!debtors.length) {
      return 'Good news — no customers currently have outstanding balances.';
    }
    const lines = debtors.map((c) => `• ${c.name}: ${formatMoney(c.outstanding)}`).join('\n');
    return `You have ${debtors.length} customer(s) with outstanding balances:\n${lines}`;
  }

  if (lower.includes('revenue') || lower.includes('earn') || lower.includes('sales') || lower.includes('income') || lower.includes('made')) {
    const start = startOfToday();
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const [today, week] = await Promise.all([
      prisma.payment.aggregate({ where: { businessId, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { businessId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, _sum: { amount: true } }),
    ]);

    return `Today's revenue is ${formatMoney(today._sum.amount ?? 0)}. Over the last 7 days you've earned ${formatMoney(week._sum.amount ?? 0)}.`;
  }

  if (lower.includes('customer')) {
    const count = await prisma.customer.count({ where: { businessId } });
    const outstanding = await prisma.customer.aggregate({ where: { businessId }, _sum: { outstanding: true } });
    return `You have ${count} customer(s) on record. Total outstanding across all customers is ${formatMoney(outstanding._sum.outstanding ?? 0)}.`;
  }

  if (lower.includes('order') || lower.includes('pending') || lower.includes('job')) {
    const [pending, total] = await Promise.all([
      prisma.order.count({ where: { businessId, status: 'Pending' } }),
      prisma.order.count({ where: { businessId } }),
    ]);
    return `You have ${total} order(s) in total, ${pending} of them are pending.`;
  }

  if (lower.includes('expense') || lower.includes('spend')) {
    const total = await prisma.expense.aggregate({ where: { businessId }, _sum: { amount: true } });
    return `Your total recorded expenses are ${formatMoney(total._sum.amount ?? 0)}.`;
  }

  if (lower.includes('summary') || lower.includes('summar') || lower.includes('overview') || lower.includes('how is') || lower.includes('how are')) {
    const [revenue, outstanding, pending, customers, orders, tasks] = await Promise.all([
      prisma.payment.aggregate({ where: { businessId, createdAt: { gte: startOfToday() } }, _sum: { amount: true } }),
      prisma.customer.aggregate({ where: { businessId }, _sum: { outstanding: true } }),
      prisma.order.count({ where: { businessId, status: 'Pending' } }),
      prisma.customer.count({ where: { businessId } }),
      prisma.order.count({ where: { businessId } }),
      prisma.task.count({ where: { businessId, completed: false } }),
    ]);

    return [
      'Here is your business summary:',
      `• Revenue today: ${formatMoney(revenue._sum.amount ?? 0)}`,
      `• Outstanding balances: ${formatMoney(outstanding._sum.outstanding ?? 0)}`,
      `• Pending orders: ${pending}`,
      `• Customers: ${customers}`,
      `• Total orders: ${orders}`,
      `• Open tasks: ${tasks}`,
    ].join('\n');
  }

  return [
    "I'm your Kaya assistant and I can answer questions using your live business data.",
    'Try asking things like:',
    '• "Who owes me money?"',
    '• "What is today\'s revenue?"',
    '• "Summarize my business."',
    '• "How many pending orders do I have?"',
  ].join('\n');
}

export const aiController = {
  conversation: asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body as { message?: string };
    if (!message) {
      throw new AppError('A message is required.', 400);
    }

    const userId = req.user?.id ?? 'anonymous';
    const businessId = req.user?.businessId;

    if (env.DIFY_API_KEY) {
      let lastError: unknown;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const result = await callDify(message, userId, businessId ? { businessId } : {});
          return ApiResponse.success(res, {
            message: 'AI response generated successfully.',
            data: {
              reply: result.answer ?? result.text ?? 'No response returned.',
              provider: 'dify',
              raw: result,
            },
          });
        } catch (error) {
          lastError = error;
        }
      }

      throw new AppError(`AI integration failed after retries: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`, 502);
    }

    if (!businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const reply = await generateLocalReply(message, businessId);

    return ApiResponse.success(res, {
      message: 'AI response generated successfully.',
      data: {
        reply,
        provider: 'kaya-local',
        raw: null,
      },
    });
  }),
};
