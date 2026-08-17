const FEATURES = [
  {
    title: 'Instant scoring',
    description: 'Every page is scored for both search engines and AI, with color-coded severity for each finding.',
  },
  {
    title: 'Copy-paste fixes',
    description: 'Findings come with ready-to-use code snippets you can drop straight into your page.',
  },
  {
    title: 'Track whole sites',
    description: 'Group URLs into projects to spot issues that repeat across pages, and schedule recurring checks.',
  },
];

export function FeatureHighlights() {
  return (
    <div className="flex flex-col divide-y divide-border rounded-2xl border border-border sm:flex-row sm:divide-x sm:divide-y-0">
      {FEATURES.map((feature) => (
        <div key={feature.title} className="flex-1 p-6">
          <h3 className="mb-2 font-display text-lg font-semibold">{feature.title}</h3>
          <p className="text-sm text-muted-foreground">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
