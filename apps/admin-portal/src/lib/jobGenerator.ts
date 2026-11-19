export interface JobDetails {
  title: string;
  department?: string;
  location?: string;
  experience?: string;
  workplaceType?: "REMOTE" | "HYBRID" | "ONSITE" | string;
}

export function generateJobDescription({
  title,
  department = "",
  location = "",
  experience = "",
  workplaceType = "HYBRID",
}: JobDetails): string {
  const cleanTitle = title.trim();
  if (!cleanTitle) return "";

  const cleanDept = (department || "").trim() || "Technology";
  const cleanLoc = (location || "").trim() || "Flexible Location";
  const cleanExp = (experience || "").trim();
  const mode =
    workplaceType === "REMOTE"
      ? "Fully Remote"
      : workplaceType === "HYBRID"
        ? "Hybrid"
        : "On-site";

  const expBullet = cleanExp
    ? `• ${cleanExp} of relevant hands-on professional experience in ${cleanTitle} or a related discipline.`
    : `• Relevant professional experience and proven domain expertise as a ${cleanTitle}.`;

  return `About the Position:
We are seeking an experienced and driven ${cleanTitle} to join our ${cleanDept} team based in ${cleanLoc} (${mode}). In this role, you will play a pivotal role in driving core initiatives, delivering high-impact solutions, and maintaining operational excellence.

Key Responsibilities:
• Lead the end-to-end delivery of high-priority deliverables and workflows within ${cleanDept}.
• Partner closely with cross-functional product, engineering, and leadership stakeholders to align on strategic objectives.
• Build, scale, and optimize fault-tolerant solutions adhering to industry best practices.
• Conduct technical reviews, establish operational standards, and mentor team members.
• Proactively identify bottlenecks and spearhead continuous improvement initiatives.

Candidate Qualifications & Skills:
${expBullet}
• Strong problem-solving, architectural design, and analytical troubleshooting capabilities.
• Demonstrated ability to thrive in a ${mode.toLowerCase()} team environment based in ${cleanLoc}.
• Clear communication and presentation skills across technical and executive levels.
• Strong dedication to quality, craftsmanship, and driving measurable business outcomes.

Work Arrangement & Benefits:
• Experience Required: ${cleanExp || "Mid-to-Senior Level"}
• Work Model: ${mode} (${cleanLoc})
• Competitive compensation structure with comprehensive benefits.
• High-ownership culture with direct visibility and career progression pathways.`;
}
