import type { Finding } from '@/shared/types';

export type FindingTemplate = Omit<Finding, 'id' | 'runId'>;

export const META_TAG_FINDING_TEMPLATES: FindingTemplate[] = [
  {
    category: 'meta-tags',
    severity: 'critical',
    title: 'Missing meta description',
    description: 'No <meta name="description"> tag was found. Search engines may generate a poor snippet instead.',
    metricValue: null,
    isMissing: true,
    suggestion: 'Add a concise, unique meta description (120-160 characters) summarizing the page.',
    codeSnippet: '<meta name="description" content="A concise, compelling summary of this page (120-160 characters).">',
  },
  {
    category: 'meta-tags',
    severity: 'warning',
    title: 'Meta description too short',
    description: 'The meta description is under 70 characters, under-using the space search engines display.',
    metricValue: '58 characters',
    isMissing: false,
    suggestion: 'Expand the description to 120-160 characters to better summarize the page.',
    codeSnippet:
      '<meta name="description" content="Expand this to 120-160 characters describing the page\'s unique value.">',
  },
  {
    category: 'meta-tags',
    severity: 'good',
    title: 'Title tag length is optimal',
    description: 'The <title> tag is 54 characters, within the recommended 50-60 character range.',
    metricValue: '54 characters',
    isMissing: false,
    suggestion: 'No action needed.',
    codeSnippet: null,
  },
  {
    category: 'meta-tags',
    severity: 'critical',
    title: 'Missing Open Graph tags',
    description: 'No og:title/og:description/og:image tags were found, which hurts link previews on social platforms.',
    metricValue: null,
    isMissing: true,
    suggestion: 'Add Open Graph tags so shared links render a rich preview.',
    codeSnippet:
      '<meta property="og:title" content="Page Title">\n<meta property="og:description" content="Page description.">\n<meta property="og:image" content="https://example.com/preview.png">',
  },
];

export const CONTENT_FINDING_TEMPLATES: FindingTemplate[] = [
  {
    category: 'content',
    severity: 'warning',
    title: 'Low word count',
    description: 'The page has approximately 180 words. Thin content can rank lower for competitive terms.',
    metricValue: '180 words',
    isMissing: false,
    suggestion: 'Expand the primary content to at least 300-500 words covering the topic in more depth.',
    codeSnippet: null,
  },
  {
    category: 'content',
    severity: 'critical',
    title: 'Primary keyword missing from first paragraph',
    description: "The page's apparent primary topic does not appear in the first 100 words of body content.",
    metricValue: null,
    isMissing: true,
    suggestion: 'Mention the primary topic naturally within the first paragraph.',
    codeSnippet: null,
  },
  {
    category: 'content',
    severity: 'good',
    title: 'Readable sentence length',
    description: 'Average sentence length is 16 words, within an easily readable range.',
    metricValue: '16 words/sentence',
    isMissing: false,
    suggestion: 'No action needed.',
    codeSnippet: null,
  },
];

export const HTML_STRUCTURE_FINDING_TEMPLATES: FindingTemplate[] = [
  {
    category: 'html-structure',
    severity: 'critical',
    title: 'Missing H1 heading',
    description: 'No <h1> element was found on the page.',
    metricValue: null,
    isMissing: true,
    suggestion: "Add a single, descriptive <h1> that reflects the page's main topic.",
    codeSnippet: '<h1>Primary page heading</h1>',
  },
  {
    category: 'html-structure',
    severity: 'warning',
    title: 'Heading levels skip a level',
    description: 'The page jumps from <h2> to <h4>, skipping <h3>, which can confuse assistive technology and crawlers.',
    metricValue: 'h2 -> h4',
    isMissing: false,
    suggestion: 'Restructure headings so levels increase sequentially (h1 -> h2 -> h3 ...).',
    codeSnippet: null,
  },
  {
    category: 'html-structure',
    severity: 'critical',
    title: 'Images missing alt text',
    description: '4 of 6 <img> elements have no alt attribute.',
    metricValue: '4 of 6 images',
    isMissing: true,
    suggestion: 'Add descriptive alt text to every meaningful image.',
    codeSnippet: '<img src="/product.jpg" alt="Describe what this image shows">',
  },
];

export const FILE_SIZE_FINDING_TEMPLATES: FindingTemplate[] = [
  {
    category: 'file-size',
    severity: 'warning',
    title: 'Large HTML document',
    description: 'The HTML document is 210 KB, larger than the recommended 100 KB budget.',
    metricValue: '210 KB',
    isMissing: false,
    suggestion: 'Remove unused markup/inline scripts or split content to reduce page weight.',
    codeSnippet: null,
  },
  {
    category: 'file-size',
    severity: 'good',
    title: 'Reasonable page weight',
    description: 'The HTML document is 42 KB, within a healthy budget for fast loading.',
    metricValue: '42 KB',
    isMissing: false,
    suggestion: 'No action needed.',
    codeSnippet: null,
  },
];

export const ALL_FINDING_TEMPLATES: FindingTemplate[] = [
  ...META_TAG_FINDING_TEMPLATES,
  ...CONTENT_FINDING_TEMPLATES,
  ...HTML_STRUCTURE_FINDING_TEMPLATES,
  ...FILE_SIZE_FINDING_TEMPLATES,
];
