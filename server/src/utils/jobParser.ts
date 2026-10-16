import { z } from 'zod';
import { CANONICAL_SKILLS, resolveCanonicalSkillDefinition } from './skillNormalizer';
import { WorkplaceType, JobType } from '../models/Job';

export interface ParsedJobData {
  title?: string;
  description: string;
  responsibilities: string[];
  requiredSkillNames: string[];
  preferredSkillNames: string[];
  minCgpa: number;
  eligibleDepartments: string[];
  eligibleGraduationYears: number[];
  workplaceType: WorkplaceType;
  jobType: JobType;
  location: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency: string;
  };
  deadline?: Date;
  parserUsed: 'deterministic' | 'llm';
}

/**
 * Zod schema to validate external or LLM parser responses.
 * Guarantees strict structure before accepting parsed data.
 */
export const parsedJobLlmSchema = z.object({
  title: z.string().trim().optional(),
  responsibilities: z.array(z.string().trim()).default([]),
  requiredSkills: z.array(z.string().trim()).default([]),
  preferredSkills: z.array(z.string().trim()).default([]),
  minCgpa: z.number().min(0).max(10).optional(),
  eligibleDepartments: z.array(z.string().trim()).default([]),
  eligibleGraduationYears: z.array(z.number().int()).default([]),
  workplaceType: z.enum(['remote', 'hybrid', 'on_site']).optional(),
  jobType: z.enum(['full_time', 'internship', 'part_time', 'contract']).optional(),
  location: z.string().trim().optional(),
  salaryRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      currency: z.string().default('INR'),
    })
    .optional(),
  deadline: z.string().optional(),
});

export type ParsedJobLlmPayload = z.infer<typeof parsedJobLlmSchema>;

/**
 * Escapes regex special characters in alias strings.
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Builds word-boundary regex for a skill alias.
 * Handles C++, C#, Node.js, and strictly enforces Java != JavaScript.
 */
const buildSkillRegex = (alias: string): RegExp => {
  const lower = alias.trim().toLowerCase();

  // Strict Java distinction: match 'java' but NOT 'javascript', 'javafx', etc.
  if (lower === 'java') {
    return /\bjava\b(?!script)/i;
  }

  // Strict JavaScript distinction
  if (lower === 'javascript') {
    return /\bjavascript\b/i;
  }
  if (lower === 'js') {
    return /\bjs\b/i;
  }

  // C++ and C#
  if (lower === 'c++' || lower === 'cpp') {
    return /(?:\bc\+\+|\bcpp\b)/i;
  }
  if (lower === 'c#' || lower === 'csharp') {
    return /(?:\bc#|\bcsharp\b)/i;
  }

  const escaped = escapeRegex(lower);
  return new RegExp(`\\b${escaped}\\b`, 'i');
};

/**
 * Deterministically scans a text chunk and resolves all matching canonical skills.
 */
export const extractCanonicalSkillsFromText = (text: string): string[] => {
  const matchedSlugs = new Set<string>();

  for (const skill of CANONICAL_SKILLS) {
    // Check main canonical name
    const mainRegex = buildSkillRegex(skill.name);
    if (mainRegex.test(text)) {
      matchedSlugs.add(skill.slug);
      continue;
    }

    // Check all registered aliases
    for (const alias of skill.aliases) {
      const aliasRegex = buildSkillRegex(alias);
      if (aliasRegex.test(text)) {
        matchedSlugs.add(skill.slug);
        break;
      }
    }
  }

  // Map slugs back to canonical display names
  return Array.from(matchedSlugs).map((slug) => {
    const canonical = CANONICAL_SKILLS.find((s) => s.slug === slug);
    return canonical ? canonical.name : slug;
  });
};

/**
 * Deterministic Job Description Parser.
 * Strictly extracts fields without hallucinating or inventing data.
 */
export const parseJobDescriptionDeterministic = (text: string): ParsedJobData => {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  // 1. Title Extraction
  let title: string | undefined;
  const titleMatch = text.match(/(?:^|\n)\s*(?:job\s+)?(?:title|role|position)\s*:\s*([^\n\r]+)/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  } else {
    // Heuristic: Check first non-empty line if short enough
    for (const line of lines) {
      if (
        line.length > 2 &&
        line.length < 80 &&
        !line.includes(':') &&
        !/^(about|overview|summary)/i.test(line)
      ) {
        title = line;
        break;
      }
    }
  }

  // 2. Responsibilities Extraction
  const responsibilities: string[] = [];
  const respHeaderRegex =
    /(?:responsibilities|key responsibilities|what you'll do|what you will do|duties|role & responsibilities|job description)\s*:?/i;
  const respHeaderIndex = lines.findIndex((l) => respHeaderRegex.test(l));

  if (respHeaderIndex !== -1) {
    for (let i = respHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      // Stop if a new major header is encountered
      if (
        /^[A-Z][A-Za-z0-9\s]{2,30}:$/.test(line) ||
        /^(requirements|qualifications|eligibility|benefits|about us)/i.test(line)
      ) {
        break;
      }
      // Check bullet points
      const bulletMatch = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (bulletMatch && bulletMatch[1]) {
        responsibilities.push(bulletMatch[1].trim());
      } else if (line.length > 15 && responsibilities.length > 0) {
        // Line continuation or regular paragraph responsibility
        responsibilities.push(line);
      }
    }
  }

  // 3. Section Separation for Required vs Preferred Skills
  const preferredMatch = text.match(
    /(?:preferred|nice to have|good to have|bonus|optional)\s*(?:qualifications|skills|requirements)?\s*:?([\s\S]*?)(?:(?:requirements|responsibilities|benefits|about us|eligibility)\s*:?|$)/i
  );
  const preferredSectionText = preferredMatch ? preferredMatch[1] : '';

  const allSkills = extractCanonicalSkillsFromText(text);
  const preferredSkills: string[] = preferredSectionText
    ? extractCanonicalSkillsFromText(preferredSectionText)
    : [];
  const requiredSkills = allSkills.filter((s) => !preferredSkills.includes(s));

  // 4. Eligibility: CGPA
  let minCgpa = 0;
  const cgpaMatch =
    text.match(
      /(?:minimum|min|at least|cutoff|>=)?\s*(?:cgpa|gpa|pointer)\s*(?:of|is|:)?\s*([0-9]+(?:\.[0-9]+)?)/i
    ) || text.match(/\b([6-9](?:\.[0-9]+)?)\s*(?:cgpa|gpa)\b/i);

  if (cgpaMatch && cgpaMatch[1]) {
    const val = parseFloat(cgpaMatch[1]);
    if (val >= 0 && val <= 10) {
      minCgpa = val;
    }
  }

  // 5. Eligibility: Graduation Years
  const eligibleGraduationYears: number[] = [];
  const batchLineRegex =
    /(?:^|\n)[^\n\r]*(?:batch|class of|graduating|passout|graduation year)[^\n\r]*/gi;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = batchLineRegex.exec(text)) !== null) {
    const yearsInLine = lineMatch[0].match(/\b(202[4-9]|203[0-5])\b/g);
    if (yearsInLine) {
      for (const y of yearsInLine) {
        const yr = parseInt(y, 10);
        if (!eligibleGraduationYears.includes(yr)) {
          eligibleGraduationYears.push(yr);
        }
      }
    }
  }

  // 6. Eligibility: Departments
  const eligibleDepartments: string[] = [];
  const deptMap: Record<string, string> = {
    cse: 'Computer Science & Engineering',
    'computer science': 'Computer Science & Engineering',
    it: 'Information Technology',
    'information technology': 'Information Technology',
    ece: 'Electronics & Communication Engineering',
    eee: 'Electrical & Electronics Engineering',
    mechanical: 'Mechanical Engineering',
    civil: 'Civil Engineering',
  };

  for (const [key, val] of Object.entries(deptMap)) {
    const regex = new RegExp(`\\b${escapeRegex(key)}\\b`, 'i');
    if (regex.test(text) && !eligibleDepartments.includes(val)) {
      eligibleDepartments.push(val);
    }
  }

  // 7. Workplace Type
  let workplaceType: WorkplaceType = 'on_site';
  if (/\b(?:remote|work from home|wfh)\b/i.test(text)) {
    workplaceType = 'remote';
  } else if (/\bhybrid\b/i.test(text)) {
    workplaceType = 'hybrid';
  } else if (/\b(?:on-site|onsite|in-office|office)\b/i.test(text)) {
    workplaceType = 'on_site';
  }

  // 8. Job Type
  let jobType: JobType = 'full_time';
  if (/\b(?:intern|internship|trainee)\b/i.test(text)) {
    jobType = 'internship';
  } else if (/\b(?:part-time|part time)\b/i.test(text)) {
    jobType = 'part_time';
  } else if (/\b(?:contract|temporary)\b/i.test(text)) {
    jobType = 'contract';
  } else if (/\b(?:full-time|full time|permanent|fresher)\b/i.test(text)) {
    jobType = 'full_time';
  }

  // 9. Location
  let location = 'Remote';
  const locationMatch = text.match(
    /(?:location|job location|city|work location)\s*:\s*([^\n\r,]+(?:,\s*[^\n\r]+)?)/i
  );
  if (locationMatch && locationMatch[1]) {
    location = locationMatch[1].trim();
  } else {
    // Detect prominent tech hubs
    const cityRegex =
      /\b(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|Gurgaon|Gurugram|Noida|Chennai)\b/i;
    const cityMatch = text.match(cityRegex);
    if (cityMatch) {
      location = cityMatch[1].trim();
    } else if (workplaceType === 'remote') {
      location = 'Remote';
    }
  }

  // 10. Salary Range (Strict: do not invent if missing)
  let salaryRange: { min?: number; max?: number; currency: string } | undefined;
  const lpaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac)/i);
  if (lpaMatch) {
    salaryRange = {
      min: Math.round(parseFloat(lpaMatch[1]) * 100000),
      max: Math.round(parseFloat(lpaMatch[2]) * 100000),
      currency: 'INR',
    };
  } else {
    const singleLpa = text.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac)/i);
    if (singleLpa) {
      const val = Math.round(parseFloat(singleLpa[1]) * 100000);
      salaryRange = { min: val, max: val, currency: 'INR' };
    }
  }

  // 11. Deadline (Strict: do not invent if missing)
  let deadline: Date | undefined;
  const deadlineMatch = text.match(
    /(?:deadline|apply by|last date|closing date)\s*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i
  );
  if (deadlineMatch && deadlineMatch[1]) {
    const d = new Date(deadlineMatch[1]);
    if (!isNaN(d.getTime())) {
      deadline = d;
    }
  }

  return {
    title,
    description: text,
    responsibilities,
    requiredSkillNames: requiredSkills,
    preferredSkillNames: preferredSkills,
    minCgpa,
    eligibleDepartments,
    eligibleGraduationYears,
    workplaceType,
    jobType,
    location,
    salaryRange,
    deadline,
    parserUsed: 'deterministic',
  };
};

/**
 * Server-side LLM Provider Interface.
 */
export interface ILlmJobParserProvider {
  parse(text: string): Promise<string | object>;
}

/**
 * Composite Job Parser with optional LLM provider and robust deterministic fallback.
 * Strictly verifies schema and never invents unprovided requirements.
 */
export const parseJobDescription = async (
  text: string,
  options?: {
    useLlm?: boolean;
    provider?: ILlmJobParserProvider;
  }
): Promise<ParsedJobData> => {
  if (!text || !text.trim()) {
    return {
      description: '',
      responsibilities: [],
      requiredSkillNames: [],
      preferredSkillNames: [],
      minCgpa: 0,
      eligibleDepartments: [],
      eligibleGraduationYears: [],
      workplaceType: 'on_site',
      jobType: 'full_time',
      location: 'Remote',
      parserUsed: 'deterministic',
    };
  }

  // Deterministic fallback function
  const runFallback = (): ParsedJobData => parseJobDescriptionDeterministic(text);

  // If LLM parsing is not requested or no provider is configured, return deterministic parse
  if (!options?.useLlm || !options.provider) {
    return runFallback();
  }

  try {
    const rawResult = await options.provider.parse(text);
    const parsedJson = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

    // Validate LLM response against strict Zod schema
    const validation = parsedJobLlmSchema.safeParse(parsedJson);
    if (!validation.success) {
      console.warn(
        '[JobParser] LLM output failed schema validation. Falling back to deterministic parser.',
        validation.error
      );
      return runFallback();
    }

    const data = validation.data;

    // Normalize all skills through canonical skill dictionary
    const normalizeSkillList = (skills: string[]): string[] => {
      const canonicalSet = new Set<string>();
      for (const s of skills) {
        const canonical = resolveCanonicalSkillDefinition(s);
        if (canonical) {
          canonicalSet.add(canonical.name);
        } else if (s.trim()) {
          canonicalSet.add(s.trim());
        }
      }
      return Array.from(canonicalSet);
    };

    const requiredSkills = normalizeSkillList(data.requiredSkills);
    const preferredSkills = normalizeSkillList(data.preferredSkills).filter(
      (s) => !requiredSkills.includes(s)
    );

    let parsedDeadline: Date | undefined;
    if (data.deadline) {
      const d = new Date(data.deadline);
      if (!isNaN(d.getTime())) {
        parsedDeadline = d;
      }
    }

    return {
      title: data.title,
      description: text,
      responsibilities: data.responsibilities,
      requiredSkillNames: requiredSkills,
      preferredSkillNames: preferredSkills,
      minCgpa: data.minCgpa ?? 0,
      eligibleDepartments: data.eligibleDepartments,
      eligibleGraduationYears: data.eligibleGraduationYears,
      workplaceType: data.workplaceType ?? 'on_site',
      jobType: data.jobType ?? 'full_time',
      location: data.location ?? 'Remote',
      salaryRange: data.salaryRange,
      deadline: parsedDeadline,
      parserUsed: 'llm',
    };
  } catch (error) {
    console.warn(
      '[JobParser] LLM provider invocation failed. Falling back to deterministic parser.',
      error
    );
    return runFallback();
  }
};
