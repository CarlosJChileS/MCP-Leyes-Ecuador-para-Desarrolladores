import { basename, extname } from 'node:path';

export type DetectedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'kotlin'
  | 'scala'
  | 'groovy'
  | 'csharp'
  | 'fsharp'
  | 'vbnet'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'c'
  | 'cpp'
  | 'swift'
  | 'dart'
  | 'sql'
  | 'shell'
  | 'yaml'
  | 'json'
  | 'toml'
  | 'docker'
  | 'terraform'
  | 'env'
  | 'ini'
  | 'properties'
  | 'xml'
  | 'html'
  | 'css'
  | 'markdown'
  | 'php'
  | 'vue'
  | 'plaintext'
  | 'unknown';

export type LanguageFamily =
  | 'javascript'
  | 'python'
  | 'jvm'
  | 'dotnet'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'c-cpp'
  | 'swift'
  | 'dart'
  | 'sql'
  | 'shell'
  | 'config'
  | 'docker'
  | 'terraform'
  | 'markup'
  | 'docs'
  | 'other';

export type LanguageMatch = {
  language: DetectedLanguage;
  family: LanguageFamily;
};

type Matcher = (lowerName: string, lowerBase: string) => boolean;

type LanguageDefinition = {
  language: DetectedLanguage;
  family: LanguageFamily;
  extensions?: readonly string[];
  basenames?: readonly string[];
  matchers?: readonly Matcher[];
};

const matchesDockerfile: Matcher = (lowerName, lowerBase) =>
  lowerBase === 'dockerfile' ||
  lowerBase === 'containerfile' ||
  lowerBase.startsWith('dockerfile.') ||
  lowerBase.startsWith('containerfile.') ||
  lowerName.endsWith('.dockerfile');

const matchesEnvFile: Matcher = (_lowerName, lowerBase) => lowerBase.startsWith('.env');
const matchesMarkdownBasename: Matcher = (_lowerName, lowerBase) =>
  lowerBase === 'readme' || lowerBase === 'privacy' || lowerBase === 'license';

const LANGUAGE_DEFINITIONS: readonly LanguageDefinition[] = [
  { language: 'javascript', family: 'javascript', extensions: ['.js', '.jsx', '.mjs', '.cjs'] },
  { language: 'typescript', family: 'javascript', extensions: ['.ts', '.tsx', '.mts', '.cts'] },
  { language: 'python', family: 'python', extensions: ['.py'] },
  { language: 'java', family: 'jvm', extensions: ['.java'] },
  { language: 'kotlin', family: 'jvm', extensions: ['.kt', '.kts'] },
  { language: 'scala', family: 'jvm', extensions: ['.scala'] },
  { language: 'groovy', family: 'jvm', extensions: ['.groovy', '.gradle'] },
  { language: 'csharp', family: 'dotnet', extensions: ['.cs'] },
  { language: 'fsharp', family: 'dotnet', extensions: ['.fs', '.fsi', '.fsx'] },
  { language: 'vbnet', family: 'dotnet', extensions: ['.vb'] },
  { language: 'go', family: 'go', extensions: ['.go'] },
  { language: 'rust', family: 'rust', extensions: ['.rs'] },
  { language: 'ruby', family: 'ruby', extensions: ['.rb', '.rake'], basenames: ['gemfile', 'rakefile'] },
  { language: 'cpp', family: 'c-cpp', extensions: ['.cc', '.cpp', '.cxx', '.hpp', '.hh', '.hxx', '.ipp'] },
  { language: 'c', family: 'c-cpp', extensions: ['.c', '.h'] },
  { language: 'swift', family: 'swift', extensions: ['.swift'] },
  { language: 'dart', family: 'dart', extensions: ['.dart'] },
  { language: 'sql', family: 'sql', extensions: ['.sql'] },
  { language: 'shell', family: 'shell', extensions: ['.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.psd1'] },
  { language: 'yaml', family: 'config', extensions: ['.yaml', '.yml'] },
  { language: 'json', family: 'config', extensions: ['.json', '.jsonc'] },
  { language: 'toml', family: 'config', extensions: ['.toml'] },
  { language: 'docker', family: 'docker', matchers: [matchesDockerfile], extensions: ['.containerfile'] },
  { language: 'terraform', family: 'terraform', extensions: ['.tf', '.tfvars', '.hcl'] },
  { language: 'env', family: 'config', extensions: ['.env'], matchers: [matchesEnvFile] },
  { language: 'ini', family: 'config', extensions: ['.ini', '.cfg', '.conf', '.config'] },
  { language: 'properties', family: 'config', extensions: ['.properties'] },
  { language: 'xml', family: 'markup', extensions: ['.xml'] },
  { language: 'html', family: 'markup', extensions: ['.html', '.htm'] },
  { language: 'css', family: 'markup', extensions: ['.css', '.scss', '.sass', '.less'] },
  { language: 'markdown', family: 'docs', extensions: ['.md', '.mdx'], matchers: [matchesMarkdownBasename] },
  { language: 'php', family: 'other', extensions: ['.php', '.phtml'] },
  { language: 'vue', family: 'javascript', extensions: ['.vue'] },
  { language: 'plaintext', family: 'docs', extensions: ['.txt'] },
];

const EXTENSION_LOOKUP = new Map<string, LanguageDefinition>();
const BASENAME_LOOKUP = new Map<string, LanguageDefinition>();

for (const definition of LANGUAGE_DEFINITIONS) {
  for (const extension of definition.extensions ?? []) {
    EXTENSION_LOOKUP.set(extension, definition);
  }
  for (const fileBasename of definition.basenames ?? []) {
    BASENAME_LOOKUP.set(fileBasename, definition);
  }
}

const FALLBACK_TEXT_EXTENSIONS = new Set([
  '.conf',
  '.config',
  '.cfg',
  '.ini',
  '.env',
  '.md',
  '.txt',
  '.log',
]);

export const KNOWN_LANGUAGE_ORDER = LANGUAGE_DEFINITIONS.map((definition) => definition.language);

export function detectLanguage(filePath: string): LanguageMatch {
  const lowerName = filePath.toLowerCase();
  const lowerBase = basename(lowerName);
  const extension = extname(lowerBase);

  const extensionMatch = EXTENSION_LOOKUP.get(extension);
  if (extensionMatch) {
    return { language: extensionMatch.language, family: extensionMatch.family };
  }

  const basenameMatch = BASENAME_LOOKUP.get(lowerBase);
  if (basenameMatch) {
    return { language: basenameMatch.language, family: basenameMatch.family };
  }

  for (const definition of LANGUAGE_DEFINITIONS) {
    for (const matcher of definition.matchers ?? []) {
      if (matcher(lowerName, lowerBase)) {
        return { language: definition.language, family: definition.family };
      }
    }
  }

  if (FALLBACK_TEXT_EXTENSIONS.has(extension)) {
    return { language: 'unknown', family: 'other' };
  }

  return { language: 'unknown', family: 'other' };
}

export function isScannableTextFile(filePath: string): boolean {
  const lowerName = filePath.toLowerCase();
  const lowerBase = basename(lowerName);
  const extension = extname(lowerBase);

  if (EXTENSION_LOOKUP.has(extension) || BASENAME_LOOKUP.has(lowerBase) || FALLBACK_TEXT_EXTENSIONS.has(extension)) {
    return true;
  }

  return LANGUAGE_DEFINITIONS.some((definition) =>
    (definition.matchers ?? []).some((matcher) => matcher(lowerName, lowerBase)),
  );
}
