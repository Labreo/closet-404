import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchArchive } from '@/lib/search';

const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query must not be empty').max(300),
  threshold: z.number().min(0).optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = searchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid search request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { query, threshold } = parsed.data;
    const results = searchArchive(query, threshold ?? 0.05);

    // Return [{ id, score }] (also including title for UI/debugging)
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Search failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

