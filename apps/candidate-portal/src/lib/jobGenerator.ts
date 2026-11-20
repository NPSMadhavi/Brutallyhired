export interface JobDetails {
  title: string;
  department?: string;
  location?: string;
  experience?: string;
  keywords?: string;
  workplaceType?: "REMOTE" | "HYBRID" | "ONSITE" | string;
}

export function generateJobDescription({
  title,
  department = "",
  location = "",
  experience = "",
  keywords = "",
  workplaceType = "HYBRID",
}: JobDetails): string {
  const cleanTitle = title.trim();
  if (!cleanTitle) return "";

  const cleanDept = (department || "").trim() || "Technology";
  const cleanLoc = (location || "").trim() || "Flexible Location";
  const cleanExp = (experience || "").trim();
  const cleanKeywords = (keywords || "").trim();
  const mode =
    workplaceType === "REMOTE"
      ? "Fully Remote"
      : workplaceType === "HYBRID"
        ? "Hybrid"
        : "On-site";

  const expBullet = cleanExp
    ? `• ${cleanExp} of relevant hands-on professional experience in ${cleanTitle} or a related discipline.`
    : `• Relevant professional experience and proven domain expertise as a ${cleanTitle}.`;

  const keywordsBullet = cleanKeywords
    ? `• Core Skills & Competencies: ${cleanKeywords}.`
    : `• Proven proficiency with industry-standard frameworks, design patterns, and engineering toolchains.`;

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
${keywordsBullet}
• Strong problem-solving, architectural design, and analytical troubleshooting capabilities.
• Demonstrated ability to thrive in a ${mode.toLowerCase()} team environment based in ${cleanLoc}.
• Clear communication and presentation skills across technical and executive levels.
• Strong dedication to quality, craftsmanship, and driving measurable business outcomes.

Work Arrangement & Benefits:
• Experience Required: ${cleanExp || "Mid-to-Senior Level"}
• Primary Technologies: ${cleanKeywords || "Domain-relevant toolchain"}
• Work Model: ${mode} (${cleanLoc})
• Competitive compensation structure with comprehensive benefits.
• High-ownership culture with direct visibility and career progression pathways.`;
}

export function generateJobDescriptionHtml({
  title,
  department = "",
  location = "",
  experience = "",
  keywords = "",
  workplaceType = "HYBRID",
}: JobDetails): string {
  const cleanTitle = title.trim();
  if (!cleanTitle) return "";

  const cleanDept = (department || "").trim() || "Technology";
  const cleanLoc = (location || "").trim() || "Flexible Location";
  const cleanExp = (experience || "").trim();
  const cleanKeywords = (keywords || "").trim();
  const mode =
    workplaceType === "REMOTE"
      ? "Fully Remote"
      : workplaceType === "HYBRID"
        ? "Hybrid"
        : "On-site";

  const expBullet = cleanExp
    ? `<li><strong>${cleanExp}</strong> of relevant hands-on professional experience in ${cleanTitle} or a related discipline.</li>`
    : `<li>Proven domain expertise and hands-on professional experience as a <strong>${cleanTitle}</strong>.</li>`;

  const keywordsBullet = cleanKeywords
    ? `<li><strong>Core Technical Competencies:</strong> ${cleanKeywords}.</li>`
    : `<li>Demonstrated proficiency with modern architectural design patterns, distributed frameworks, and cloud systems.</li>`;

  return `<h2>About the Position</h2>
<p>We are seeking an experienced, proactive <strong>${cleanTitle}</strong> to join our <strong>${cleanDept}</strong> team based in <strong>${cleanLoc} (${mode})</strong>. In this role, you will take ownership of architectural decisions, drive core product initiatives, and deliver scalable, mission-critical systems that shape our platform.</p>

<h2>Key Responsibilities</h2>
<ul>
  <li>Architect and drive the end-to-end implementation of high-throughput services within <strong>${cleanDept}</strong>.</li>
  <li>Collaborate closely with cross-functional product, UX, and systems engineering teams to define specifications.</li>
  <li>Maintain operational rigor, automated unit/integration test coverage, and high-availability SLA standards.</li>
  <li>Conduct structured code reviews, establish architectural guidelines, and mentor junior and mid-level engineers.</li>
  <li>Diagnose production bottlenecks and implement proactive observability, tracing, and performance optimizations.</li>
</ul>

<h2>Required Skills & Core Competencies</h2>
<ul>
  ${keywordsBullet}
  <li>Deep understanding of RESTful / WebSocket API design, event-driven pipelines, and relational databases.</li>
  <li>Hands-on experience in automated CI/CD pipelines, containerized environments, and cloud deployment.</li>
  <li>Strong debugging instincts, root-cause analysis skills, and adherence to clean-code principles.</li>
</ul>

<h2>Qualifications & Experience</h2>
<ul>
  ${expBullet}
  <li>Bachelor's or Master's degree in Computer Science, Engineering, or equivalent practical industry track record.</li>
  <li>Excellent communication skills with the ability to articulate complex technical trade-offs to stakeholders.</li>
  <li>Proven capacity to thrive in a high-ownership, <strong>${mode.toLowerCase()}</strong> working culture.</li>
</ul>

<h2>Work Arrangement, Benefits & Perks</h2>
<ul>
  <li><strong>Workplace Model:</strong> ${mode} (${cleanLoc}). Flexible schedule with remote-friendly collaboration tooling.</li>
  <li><strong>Compensation:</strong> Competitive top-of-market compensation with performance bonuses and equity incentives.</li>
  <li><strong>Health & Wellness:</strong> Comprehensive health, dental, and vision coverage for employees and dependents.</li>
  <li><strong>Learning & Growth:</strong> Generous annual education stipend, conference budgets, and mentorship pathways.</li>
  <li><strong>Equipment:</strong> Top-tier workstation setup (MacBook Pro / ThinkPad, 4K monitors, ergonomic peripherals).</li>
</ul>

<h2>Additional Information & Selection Process</h2>
<p>Our recruitment journey is streamlined and objective: initial AI resume screening, automated proctored technical challenge, panel deep-dive interview, and prompt offer turnaround. We are an equal opportunity employer committed to diversity and inclusive hiring.</p>`;
}
