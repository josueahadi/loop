// Shape of the shared policy.json (generated from legal/privacy-policy.md).
export type PolicyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'note'; text: string }
  | { type: 'list'; items: string[] };

export interface PolicySection {
  number: number;
  heading: string;
  blocks: PolicyBlock[];
}

export interface Policy {
  version: string;
  lastUpdated: string;
  contactEmail: string;
  placeholders: Record<string, string>;
  sections: PolicySection[];
}
