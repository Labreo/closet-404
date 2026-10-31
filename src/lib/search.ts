import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Site } from '../types/archive';

export interface SearchResult {
  id: string;
  title: string;
  score: number;
}

interface IndexedDoc {
  id: string;
  title: string;
  termFrequencies: Map<string, number>;
  docLength: number;
  rawSearchString: string;
}

let cachedDocs: IndexedDoc[] | null = null;
let cachedAvgDl = 0;
let cachedArchiveCount = 0;

const STOPWORDS = new Set(
  'a an and are as at be by for from has have i in is it its me my of on or our that the this to was were with you your'.split(' ')
);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

function loadAndIndexArchive(): {
  docs: IndexedDoc[];
  avgdl: number;
  totalDocs: number;
} {
  if (cachedDocs !== null) {
    return {
      docs: cachedDocs,
      avgdl: cachedAvgDl,
      totalDocs: cachedArchiveCount,
    };
  }

  const archivePath = path.resolve(process.cwd(), 'data/archive.json');
  if (!fs.existsSync(archivePath)) {
    return { docs: [], avgdl: 0, totalDocs: 0 };
  }

  const rawJson = fs.readFileSync(archivePath, 'utf-8');
  let sites: Site[] = [];
  try {
    sites = JSON.parse(rawJson) as Site[];
  } catch {
    sites = [];
  }

  const docs: IndexedDoc[] = [];

  for (const site of sites) {
    const titleTokens = tokenize(site.title);
    const vibeTokens = tokenize(site.vibeTags?.join(' ') || '');
    const eulogyTokens = tokenize(site.eulogy || '');
    const categoryTokens = tokenize(site.category || '');
    const bodyTokens = tokenize(site.forensics?.bodyText || '');
    const commentTokens = tokenize(site.forensics?.comments?.join(' ') || '');
    const urlTokens = tokenize(site.url || '');

    const termFrequencies = new Map<string, number>();

    function addTokens(tokens: string[], weight: number) {
      for (const t of tokens) {
        termFrequencies.set(t, (termFrequencies.get(t) || 0) + weight);
      }
    }

    addTokens(titleTokens, 3.0);
    addTokens(vibeTokens, 2.5);
    addTokens(categoryTokens, 2.0);
    addTokens(eulogyTokens, 2.0);
    addTokens(commentTokens, 1.5);
    addTokens(urlTokens, 1.5);
    addTokens(bodyTokens, 1.0);

    let docLength = 0;
    for (const weight of termFrequencies.values()) {
      docLength += weight;
    }

    const rawSearchString = [
      site.title,
      site.vibeTags?.join(' '),
      site.eulogy,
      site.category,
      site.url,
      site.forensics?.bodyText,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    docs.push({
      id: site.id,
      title: site.title,
      termFrequencies,
      docLength,
      rawSearchString,
    });
  }

  const totalDocs = docs.length;
  const avgdl = totalDocs > 0 ? docs.reduce((sum, d) => sum + d.docLength, 0) / totalDocs : 0;

  cachedDocs = docs;
  cachedAvgDl = avgdl;
  cachedArchiveCount = totalDocs;

  return { docs, avgdl, totalDocs };
}

// Optional embeddings cache
interface EmbeddingsFile {
  model: string;
  embeddings: Record<string, number[]>;
}

let cachedEmbeddings: EmbeddingsFile | null = null;

function loadEmbeddings(): EmbeddingsFile | null {
  if (cachedEmbeddings !== null) return cachedEmbeddings;
  const embPath = path.resolve(process.cwd(), 'data/embeddings.json');
  if (!fs.existsSync(embPath)) return null;

  try {
    const raw = fs.readFileSync(embPath, 'utf-8');
    cachedEmbeddings = JSON.parse(raw) as EmbeddingsFile;
    return cachedEmbeddings;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * BM25 Keyword Search with optional Embedding Fusion.
 * Zero model loading required in default operation.
 */
export function searchArchive(
  query: string,
  threshold = 0.05,
  queryEmbedding?: number[]
): SearchResult[] {
  const { docs, avgdl, totalDocs } = loadAndIndexArchive();
  if (totalDocs === 0) return [];

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const queryLower = query.toLowerCase().trim();
  const k1 = 1.2;
  const b = 0.75;

  const results: SearchResult[] = [];

  // Pre-calculate document frequencies for query terms
  const docFrequencies = new Map<string, number>();
  for (const term of queryTerms) {
    const count = docs.filter((d) => d.termFrequencies.has(term)).length;
    docFrequencies.set(term, count);
  }

  const embeddingsData = loadEmbeddings();

  for (const doc of docs) {
    let bm25Score = 0;

    for (const term of queryTerms) {
      const df = docFrequencies.get(term) || 0;
      if (df === 0) continue;

      // Robertson-Spärck Jones IDF
      const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
      const tf = doc.termFrequencies.get(term) || 0;

      if (tf > 0) {
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (doc.docLength / avgdl));
        bm25Score += idf * (numerator / denominator);
      }
    }

    // Exact phrase boost for multi-word queries
    if (queryTerms.length > 1 && doc.rawSearchString.includes(queryLower)) {
      bm25Score += 4.0;
    }

    let finalScore = bm25Score;

    // Optional embedding fusion if embeddings exist and queryEmbedding is provided
    if (embeddingsData && queryEmbedding && embeddingsData.embeddings[doc.id]) {
      const docEmbedding = embeddingsData.embeddings[doc.id];
      const cosSim = cosineSimilarity(queryEmbedding, docEmbedding);
      // Fuse BM25 (scaled) and cosine similarity (0..1)
      finalScore = bm25Score * 0.7 + cosSim * 10 * 0.3;
    }

    if (finalScore >= threshold) {
      results.push({
        id: doc.id,
        title: doc.title,
        score: Math.round(finalScore * 100) / 100,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

