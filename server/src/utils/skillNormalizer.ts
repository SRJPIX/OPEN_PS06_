import { Skill, ISkill, SkillCategory } from '../models/Skill';

export interface CanonicalSkillDefinition {
  slug: string;
  name: string;
  category: SkillCategory;
  aliases: string[];
  description?: string;
}

export const CANONICAL_SKILLS: CanonicalSkillDefinition[] = [
  {
    slug: 'react',
    name: 'React',
    category: 'frontend',
    aliases: ['react', 'reactjs', 'react.js', 'react js'],
    description: 'React declarative component-based user interface library',
  },
  {
    slug: 'javascript',
    name: 'JavaScript',
    category: 'frontend',
    aliases: ['javascript', 'js', 'vanilla js', 'es6', 'ecmascript'],
    description: 'JavaScript ECMAScript standard scripting language',
  },
  {
    slug: 'nodejs',
    name: 'Node.js',
    category: 'backend',
    aliases: ['nodejs', 'node.js', 'node js', 'node'],
    description: 'Node.js asynchronous event-driven JavaScript runtime',
  },
  {
    slug: 'java',
    name: 'Java',
    category: 'backend',
    aliases: ['java', 'core java', 'j2se', 'java 8', 'java 11', 'java 17', 'java 21'],
    description: 'Java class-based object-oriented programming language',
  },
  {
    slug: 'typescript',
    name: 'TypeScript',
    category: 'frontend',
    aliases: ['typescript', 'ts'],
    description: 'TypeScript strongly typed superset of JavaScript',
  },
  {
    slug: 'python',
    name: 'Python',
    category: 'backend',
    aliases: ['python', 'python3', 'python 3', 'py'],
    description: 'Python interpreted high-level general-purpose programming language',
  },
  {
    slug: 'mongodb',
    name: 'MongoDB',
    category: 'database',
    aliases: ['mongodb', 'mongo', 'mongo db'],
    description: 'MongoDB document-oriented NoSQL database system',
  },
  {
    slug: 'postgresql',
    name: 'PostgreSQL',
    category: 'database',
    aliases: ['postgresql', 'postgres', 'psql'],
    description: 'PostgreSQL object-relational database system',
  },
  {
    slug: 'express',
    name: 'Express',
    category: 'backend',
    aliases: ['express', 'expressjs', 'express.js', 'express js'],
    description: 'Express minimal and flexible Node.js web application framework',
  },
  {
    slug: 'cplusplus',
    name: 'C++',
    category: 'backend',
    aliases: ['c++', 'cpp', 'c plus plus'],
    description: 'C++ high-performance general-purpose programming language',
  },
  {
    slug: 'csharp',
    name: 'C#',
    category: 'backend',
    aliases: ['c#', 'csharp', 'c sharp'],
    description: 'C# modern object-oriented programming language for .NET',
  },
  {
    slug: 'docker',
    name: 'Docker',
    category: 'devops',
    aliases: ['docker', 'dockerfile', 'containerization'],
    description: 'Docker containerization platform',
  },
  {
    slug: 'kubernetes',
    name: 'Kubernetes',
    category: 'devops',
    aliases: ['kubernetes', 'k8s'],
    description: 'Kubernetes container orchestration system',
  },
  {
    slug: 'aws',
    name: 'AWS',
    category: 'cloud',
    aliases: ['aws', 'amazon web services'],
    description: 'Amazon Web Services cloud computing platform',
  },
  {
    slug: 'git',
    name: 'Git',
    category: 'devops',
    aliases: ['git', 'version control', 'git vcs'],
    description: 'Git distributed version control system',
  },
  {
    slug: 'tailwind',
    name: 'Tailwind CSS',
    category: 'frontend',
    aliases: ['tailwind', 'tailwindcss', 'tailwind css'],
    description: 'Tailwind utility-first CSS framework',
  },
  {
    slug: 'html',
    name: 'HTML5',
    category: 'frontend',
    aliases: ['html', 'html5'],
    description: 'HyperText Markup Language standard for document structuring',
  },
  {
    slug: 'css',
    name: 'CSS3',
    category: 'frontend',
    aliases: ['css', 'css3'],
    description: 'Cascading Style Sheets presentation language',
  },
  {
    slug: 'graphql',
    name: 'GraphQL',
    category: 'backend',
    aliases: ['graphql', 'gql'],
    description: 'GraphQL query language and runtime for APIs',
  },
  {
    slug: 'redis',
    name: 'Redis',
    category: 'database',
    aliases: ['redis', 'redis cache'],
    description: 'Redis in-memory key-value data structure store',
  },
];

/**
 * Normalizes raw string input (trims, collapses multiple whitespaces, lowercases).
 */
export const normalizeRawSkillString = (input: string): string => {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * In-memory alias resolution map lookup.
 * Strictly guarantees Java and JavaScript remain separate.
 */
export const resolveCanonicalSkillDefinition = (input: string): CanonicalSkillDefinition | null => {
  const normalized = normalizeRawSkillString(input);
  if (!normalized) return null;

  // Strict check: 'java' and 'core java' must NEVER resolve to JavaScript
  if (normalized === 'java' || normalized === 'core java' || normalized === 'j2se') {
    return CANONICAL_SKILLS.find((s) => s.slug === 'java') || null;
  }

  // Strict check: 'javascript' and 'js' must NEVER resolve to Java
  if (
    normalized === 'js' ||
    normalized === 'javascript' ||
    normalized === 'vanilla js' ||
    normalized === 'es6' ||
    normalized === 'ecmascript'
  ) {
    return CANONICAL_SKILLS.find((s) => s.slug === 'javascript') || null;
  }

  // Find by slug, name, or alias in canonical dictionary
  for (const skill of CANONICAL_SKILLS) {
    if (
      skill.slug === normalized ||
      skill.name.toLowerCase() === normalized ||
      skill.aliases.includes(normalized)
    ) {
      return skill;
    }
  }

  return null;
};

/**
 * Resolves an input skill name, alias, or ID to a persistent Skill document in MongoDB.
 * If found in canonical dictionary, retrieves or creates the corresponding Skill record.
 */
export const resolveSkillDocument = async (input: string): Promise<ISkill | null> => {
  const normalized = normalizeRawSkillString(input);
  if (!normalized) return null;

  // 1. Check if input is a valid MongoDB ObjectId
  if (/^[0-9a-fA-F]{24}$/.test(input.trim())) {
    const byId = await Skill.findById(input.trim());
    if (byId) return byId;
  }

  // 2. Check canonical dictionary
  const canonicalDef = resolveCanonicalSkillDefinition(input);
  if (canonicalDef) {
    const existing = await Skill.findOne({ slug: canonicalDef.slug });
    if (existing) return existing;

    // Create if not yet seeded
    return Skill.create({
      slug: canonicalDef.slug,
      name: canonicalDef.name,
      category: canonicalDef.category,
      aliases: canonicalDef.aliases,
      description: canonicalDef.description,
    });
  }

  // 3. Fallback: search database by slug, name, or aliases
  return Skill.findOne({
    $or: [
      { slug: normalized },
      { name: new RegExp(`^${normalized}$`, 'i') },
      { aliases: normalized },
    ],
  });
};

/**
 * Seeds all canonical skills into the database.
 */
export const seedCanonicalSkills = async (): Promise<number> => {
  let seededCount = 0;
  for (const def of CANONICAL_SKILLS) {
    const existing = await Skill.findOne({ slug: def.slug });
    if (!existing) {
      await Skill.create({
        slug: def.slug,
        name: def.name,
        category: def.category,
        aliases: def.aliases,
        description: def.description,
      });
      seededCount++;
    } else {
      // Keep aliases and category updated
      existing.aliases = Array.from(new Set([...existing.aliases, ...def.aliases]));
      existing.name = def.name;
      existing.category = def.category;
      if (def.description) existing.description = def.description;
      await existing.save();
    }
  }
  return seededCount;
};
