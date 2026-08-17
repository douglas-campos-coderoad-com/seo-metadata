import { Tag, FileText, Heading1, Braces, Sparkles, Image as ImageIcon, Share2, Bot, Zap, type LucideIcon } from 'lucide-react';
import type { FindingCategory } from '@/shared/types';

// One icon per analyser category (backend/src/services/report_mappings.py's
// CATEGORY_LABELS keys) — shared so FindingsList and SharedIssuesPanel can't drift.
export const CATEGORY_ICONS: Record<FindingCategory, LucideIcon> = {
  metadata: Tag,
  content: FileText,
  headings: Heading1,
  structured_data: Braces,
  geo_aeo: Sparkles,
  images: ImageIcon,
  social: Share2,
  crawlability: Bot,
  performance: Zap,
};
