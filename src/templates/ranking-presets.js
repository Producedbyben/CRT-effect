export const RANKING_TEMPLATES = [
  {
    id: "ranked-highlight",
    name: "Ranked Highlight",
    overlays: [
      { type: "text", props: { role: "title", text: "Top Plays" } },
      { type: "text", props: { role: "score", text: "0 - 0" } },
    ],
  },
  {
    id: "scoreboard-classic",
    name: "Scoreboard Classic",
    overlays: [
      { type: "shape", props: { role: "header-bar" } },
      { type: "text", props: { role: "team-a", text: "TEAM A" } },
      { type: "text", props: { role: "team-b", text: "TEAM B" } },
    ],
  },
];

export function getTemplate(templateId) {
  return RANKING_TEMPLATES.find((tpl) => tpl.id === templateId) || RANKING_TEMPLATES[0];
}
