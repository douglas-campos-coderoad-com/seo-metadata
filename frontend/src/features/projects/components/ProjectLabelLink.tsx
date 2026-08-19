import Link from 'next/link';

interface ProjectLabelLinkProps {
  projectId: number;
  title: string;
}

/** Clickable project name, navigating to its page (specs/009-project-analysis-ux
 * User Story 3, FR-013/FR-014). */
export function ProjectLabelLink({ projectId, title }: ProjectLabelLinkProps) {
  return (
    <Link href={`/projects/${projectId}`} className="text-sm font-medium text-primary hover:underline">
      {title}
    </Link>
  );
}
