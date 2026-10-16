import { Types } from 'mongoose';
import { IJob, Job } from '../models/Job';

export interface ExactDuplicateCheckResult {
  isDuplicate: boolean;
  duplicateJob?: IJob;
  matchType?: 'requisition_id' | 'source_url';
  message?: string;
}

export interface DuplicateSuggestion {
  jobId: Types.ObjectId;
  title: string;
  requisitionId?: string;
  similarityScore: number;
  matchReasons: string[];
}

/**
 * Normalizes URL for exact duplicate comparison (strips trailing slashes, protocol variation, tracking query parameters).
 */
export const normalizeUrl = (rawUrl?: string): string => {
  if (!rawUrl || !rawUrl.trim()) return '';
  try {
    const url = new URL(rawUrl.trim());
    // Strip common tracking query params
    const searchParams = new URLSearchParams(url.search);
    const trackingKeys = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
    ];
    trackingKeys.forEach((key) => searchParams.delete(key));
    const cleanSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const cleanPath = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${cleanPath}${cleanSearch}`.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
};

/**
 * Checks if a candidate job is an exact duplicate based on requisition ID or source URL.
 */
export const checkExactDuplicate = async (params: {
  companyId: Types.ObjectId | string;
  requisitionId?: string;
  sourceUrl?: string;
  excludeJobId?: Types.ObjectId | string;
}): Promise<ExactDuplicateCheckResult> => {
  const { companyId, requisitionId, sourceUrl, excludeJobId } = params;

  // 1. Exact Requisition ID check within the same company
  if (requisitionId && requisitionId.trim()) {
    const reqQuery: Record<string, unknown> = {
      company: companyId,
      requisitionId: new RegExp(`^${requisitionId.trim()}$`, 'i'),
      status: { $ne: 'archived' },
    };
    if (excludeJobId) {
      reqQuery._id = { $ne: excludeJobId };
    }

    const existingReq = await Job.findOne(reqQuery);
    if (existingReq) {
      return {
        isDuplicate: true,
        duplicateJob: existingReq,
        matchType: 'requisition_id',
        message: `Exact duplicate detected: An active job with requisition ID '${requisitionId.trim()}' already exists for this company.`,
      };
    }
  }

  // 2. Exact Source URL check
  if (sourceUrl && sourceUrl.trim()) {
    const cleanUrl = normalizeUrl(sourceUrl);
    const urlQuery: Record<string, unknown> = {
      status: { $ne: 'archived' },
      $or: [
        { sourceUrl: new RegExp(`^${escapeRegex(sourceUrl.trim())}$`, 'i') },
        { sourceUrl: new RegExp(`^${escapeRegex(cleanUrl)}$`, 'i') },
      ],
    };
    if (excludeJobId) {
      urlQuery._id = { $ne: excludeJobId };
    }

    const existingUrl = await Job.findOne(urlQuery);
    if (existingUrl) {
      return {
        isDuplicate: true,
        duplicateJob: existingUrl,
        matchType: 'source_url',
        message: `Exact duplicate detected: A job with source URL '${sourceUrl.trim()}' already exists in the system.`,
      };
    }
  }

  return { isDuplicate: false };
};

/**
 * Normalizes job title for similarity matching (strips seniority abbreviations, levels, punctuation).
 */
export const normalizeJobTitle = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/\b(sr\.|sr|senior)\b/g, 'senior')
    .replace(/\b(jr\.|jr|junior)\b/g, 'junior')
    .replace(/\b(sde[-\s]?1|sde[-\s]?i)\b/g, 'software development engineer 1')
    .replace(/\b(sde[-\s]?2|sde[-\s]?ii)\b/g, 'software development engineer 2')
    .replace(/\b(sde[-\s]?3|sde[-\s]?iii)\b/g, 'software development engineer 3')
    .replace(/\b(dev|developer)\b/g, 'engineer')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const STOPWORDS = new Set([
  'the',
  'is',
  'at',
  'which',
  'on',
  'and',
  'a',
  'an',
  'in',
  'to',
  'for',
  'with',
  'of',
  'as',
  'by',
  'that',
  'this',
  'we',
  'you',
  'our',
  'are',
  'be',
  'will',
  'from',
  'or',
  'have',
  'has',
  'had',
  'been',
  'about',
  'all',
  'any',
  'can',
  'do',
  'if',
  'into',
]);

const tokenize = (text: string): Set<string> => {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
};

const jaccardSimilarity = (setA: Set<string>, setB: Set<string>): number => {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
};

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Calculates similarity-based duplicate suggestions.
 * Strictly adheres to rule: Never merge or suggest distinct requisitions solely because titles match.
 */
export const calculateDuplicateSuggestions = async (params: {
  companyId: Types.ObjectId | string;
  title: string;
  description: string;
  location?: string;
  requisitionId?: string;
  excludeJobId?: Types.ObjectId | string;
}): Promise<DuplicateSuggestion[]> => {
  const {
    companyId,
    title,
    description,
    location = 'Remote',
    requisitionId,
    excludeJobId,
  } = params;

  const candidateTitleNorm = normalizeJobTitle(title);
  const candidateTitleTokens = tokenize(candidateTitleNorm);
  const candidateDescTokens = tokenize(description);

  const query: Record<string, unknown> = {
    company: companyId,
    status: { $ne: 'archived' },
  };
  if (excludeJobId) {
    query._id = { $ne: excludeJobId };
  }

  const existingJobs = await Job.find(query).limit(50);
  const suggestions: DuplicateSuggestion[] = [];

  for (const job of existingJobs) {
    // RULE (Requirement #12): If both jobs have explicit requisition IDs and they differ,
    // they are distinct requisitions! Never suggest them as duplicates based solely on title.
    if (
      requisitionId &&
      job.requisitionId &&
      requisitionId.trim().toLowerCase() !== job.requisitionId.trim().toLowerCase()
    ) {
      continue;
    }

    // 1. Title Similarity
    const existingTitleNorm = normalizeJobTitle(job.title);
    const existingTitleTokens = tokenize(existingTitleNorm);
    const titleScore = jaccardSimilarity(candidateTitleTokens, existingTitleTokens);

    // 2. Location Similarity
    let locationScore = 0.5;
    const locA = (location || '').toLowerCase().trim();
    const locB = (job.location || '').toLowerCase().trim();
    if (locA === locB) {
      locationScore = 1.0;
    } else if (
      (locA.includes('remote') && locB.includes('remote')) ||
      (locA.includes('bangalore') && locB.includes('bengaluru')) ||
      (locA.includes('bengaluru') && locB.includes('bangalore'))
    ) {
      locationScore = 1.0;
    } else if (locA && locB && (locA.includes(locB) || locB.includes(locA))) {
      locationScore = 0.8;
    } else {
      locationScore = 0.0;
    }

    // 3. Description Similarity
    const existingDescTokens = tokenize(job.description);
    const descScore = jaccardSimilarity(candidateDescTokens, existingDescTokens);

    // Weighted Combined Score
    // Title: 40%, Description: 40%, Location: 20%
    const combinedScore = titleScore * 0.4 + descScore * 0.4 + locationScore * 0.2;

    // Threshold for duplicate suggestion
    if (combinedScore >= 0.65) {
      const matchReasons: string[] = [];
      if (titleScore >= 0.7) {
        matchReasons.push(`High title similarity (${Math.round(titleScore * 100)}%)`);
      }
      if (descScore >= 0.5) {
        matchReasons.push(`Description overlap (${Math.round(descScore * 100)}%)`);
      }
      if (locationScore >= 0.8) {
        matchReasons.push(`Matching location: '${job.location}'`);
      }

      suggestions.push({
        jobId: job._id as Types.ObjectId,
        title: job.title,
        requisitionId: job.requisitionId,
        similarityScore: Math.round(combinedScore * 100) / 100,
        matchReasons,
      });
    }
  }

  // Sort descending by similarity score
  return suggestions.sort((a, b) => b.similarityScore - a.similarityScore);
};

/**
 * Merges a duplicate job into a target primary job.
 * Preserves source provenance and history.
 * Strictly prevents merging distinct requisitions.
 */
export const mergeJobs = async (params: {
  primaryJobId: Types.ObjectId | string;
  duplicateJobId: Types.ObjectId | string;
  mergedByUserId: Types.ObjectId | string;
  notes?: string;
}): Promise<IJob> => {
  const { primaryJobId, duplicateJobId, mergedByUserId, notes } = params;

  if (primaryJobId.toString() === duplicateJobId.toString()) {
    throw new Error('Cannot merge a job into itself.');
  }

  const primaryJob = await Job.findById(primaryJobId);
  if (!primaryJob) {
    throw new Error('Primary job not found.');
  }

  const duplicateJob = await Job.findById(duplicateJobId);
  if (!duplicateJob) {
    throw new Error('Duplicate job not found.');
  }

  // REQUIREMENT #12: Never merge distinct requisitions solely because their titles match!
  if (
    primaryJob.requisitionId &&
    duplicateJob.requisitionId &&
    primaryJob.requisitionId.trim().toLowerCase() !==
      duplicateJob.requisitionId.trim().toLowerCase()
  ) {
    throw new Error(
      `Cannot merge distinct requisitions: Primary REQ ID '${primaryJob.requisitionId}' vs Duplicate REQ ID '${duplicateJob.requisitionId}'. Distinct requisitions represent separate openings and cannot be merged.`
    );
  }

  // 1. Union required and preferred skills
  const existingReqSkills = new Set(primaryJob.requiredSkills.map((id) => id.toString()));
  for (const skillId of duplicateJob.requiredSkills) {
    if (!existingReqSkills.has(skillId.toString())) {
      primaryJob.requiredSkills.push(skillId);
      existingReqSkills.add(skillId.toString());
    }
  }

  const existingPrefSkills = new Set(primaryJob.preferredSkills.map((id) => id.toString()));
  for (const skillId of duplicateJob.preferredSkills) {
    if (!existingPrefSkills.has(skillId.toString()) && !existingReqSkills.has(skillId.toString())) {
      primaryJob.preferredSkills.push(skillId);
      existingPrefSkills.add(skillId.toString());
    }
  }

  // 2. Union responsibilities
  if (duplicateJob.responsibilities && duplicateJob.responsibilities.length > 0) {
    const existingResp = new Set(primaryJob.responsibilities.map((r) => r.trim().toLowerCase()));
    for (const resp of duplicateJob.responsibilities) {
      if (!existingResp.has(resp.trim().toLowerCase())) {
        primaryJob.responsibilities.push(resp);
        existingResp.add(resp.trim().toLowerCase());
      }
    }
  }

  // 3. Preserve source provenance in primary job
  if (!primaryJob.provenance) {
    primaryJob.provenance = { mergedFrom: [] };
  }
  if (!primaryJob.provenance.mergedFrom) {
    primaryJob.provenance.mergedFrom = [];
  }

  primaryJob.provenance.mergedFrom.push({
    jobId: duplicateJob._id as Types.ObjectId,
    requisitionId: duplicateJob.requisitionId,
    sourceUrl: duplicateJob.sourceUrl,
    sourceType: duplicateJob.sourceType,
    mergedAt: new Date(),
    mergedBy: new Types.ObjectId(mergedByUserId),
    notes: notes || 'Merged duplicate posting',
  });

  // 4. Update duplicate job state
  duplicateJob.duplicateOf = primaryJob._id as Types.ObjectId;
  duplicateJob.status = 'archived';

  await duplicateJob.save();
  await primaryJob.save();

  return primaryJob;
};
