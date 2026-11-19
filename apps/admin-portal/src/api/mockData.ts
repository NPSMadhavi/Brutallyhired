export interface AdminJob {
  id: string;
  externalRef: string;
  title: string;
  department: string;
  location: string;
  workplaceType: "REMOTE" | "HYBRID" | "ONSITE";
  status: "OPEN" | "DRAFT" | "CLOSED";
  description: string;
  updatedAt: string;
  _count?: { applications: number };
}

export interface AdminApplication {
  id: string;
  stage: string;
  jobId: string;
  job: { title: string };
  user: { email: string };
  submittedAt: string;
  scores: Array<{
    id: string;
    total: number;
    hardScore: number;
    preferredScore: number;
    notes?: string;
  }>;
  recruiterUserId?: string;
}

export interface AdminInterview {
  id: string;
  roundName: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  interviewerName: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
}

export interface AdminStaff {
  id: string;
  role: "ADMIN" | "RECRUITER" | "INTERVIEWER";
  title?: string;
  user: { email: string; displayName?: string };
  createdAt: string;
}

export const MOCK_JOBS: AdminJob[] = [];

export const MOCK_APPLICATIONS: AdminApplication[] = [
  {
    id: "app-101",
    stage: "IN_REVIEW",
    jobId: "job-1",
    job: { title: "Senior Full Stack Engineer" },
    user: { email: "rahul.sharma@example.com" },
    submittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    scores: [{ id: "sc-1", total: 88, hardScore: 50, preferredScore: 38, notes: "Strong TypeScript and distributed systems experience" }],
  },
  {
    id: "app-102",
    stage: "INTERVIEW",
    jobId: "job-1",
    job: { title: "Senior Full Stack Engineer" },
    user: { email: "priya.nair@example.com" },
    submittedAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    scores: [{ id: "sc-2", total: 94, hardScore: 50, preferredScore: 44, notes: "Exceptional architecture background and system design" }],
  },
  {
    id: "app-103",
    stage: "ASSESSMENT",
    jobId: "job-2",
    job: { title: "AI Product Manager" },
    user: { email: "aditya.k@example.com" },
    submittedAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    scores: [{ id: "sc-3", total: 79, hardScore: 45, preferredScore: 34, notes: "Good product roadmapping, assessment pending" }],
  },
  {
    id: "app-104",
    stage: "IN_REVIEW",
    jobId: "job-3",
    job: { title: "Lead Product Designer" },
    user: { email: "kavita.verma@example.com" },
    submittedAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    scores: [{ id: "sc-4", total: 54, hardScore: 30, preferredScore: 24, notes: "Below 60 threshold: Review recommended for domain depth" }],
  },
  {
    id: "app-105",
    stage: "OFFER",
    jobId: "job-1",
    job: { title: "Senior Full Stack Engineer" },
    user: { email: "amit.patel@example.com" },
    submittedAt: new Date(Date.now() - 3600000 * 120).toISOString(),
    scores: [{ id: "sc-5", total: 92, hardScore: 50, preferredScore: 42, notes: "Passed tech bar and culture fit rounds" }],
  },
  {
    id: "app-106",
    stage: "SUBMITTED",
    jobId: "job-2",
    job: { title: "AI Product Manager" },
    user: { email: "sneha.iyer@example.com" },
    submittedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    scores: [{ id: "sc-6", total: 72, hardScore: 40, preferredScore: 32, notes: "Initial score computed" }],
  },
  {
    id: "app-107",
    stage: "HIRED",
    jobId: "job-1",
    job: { title: "Senior Full Stack Engineer" },
    user: { email: "vikram.rao@example.com" },
    submittedAt: new Date(Date.now() - 3600000 * 240).toISOString(),
    scores: [{ id: "sc-7", total: 96, hardScore: 50, preferredScore: 46, notes: "Offer accepted, onboarding completed" }],
  },
];

export const MOCK_INTERVIEWS: AdminInterview[] = [
  {
    id: "int-1",
    roundName: "System Architecture Round",
    candidateName: "Priya Nair",
    candidateEmail: "priya.nair@example.com",
    jobTitle: "Senior Full Stack Engineer",
    scheduledAt: new Date(Date.now() + 3600000 * 3).toISOString(),
    durationMinutes: 45,
    interviewerName: "Arun K. (Principal Arch)",
    status: "SCHEDULED",
  },
  {
    id: "int-2",
    roundName: "Technical Deep-Dive",
    candidateName: "Rahul Sharma",
    candidateEmail: "rahul.sharma@example.com",
    jobTitle: "Senior Full Stack Engineer",
    scheduledAt: new Date(Date.now() + 3600000 * 24).toISOString(),
    durationMinutes: 60,
    interviewerName: "Chandra S. (Lead Eng)",
    status: "SCHEDULED",
  },
  {
    id: "int-3",
    roundName: "Product Sense & AI Strategy",
    candidateName: "Aditya K.",
    candidateEmail: "aditya.k@example.com",
    jobTitle: "AI Product Manager",
    scheduledAt: new Date(Date.now() + 3600000 * 48).toISOString(),
    durationMinutes: 45,
    interviewerName: "Tanuja M. (Head of Product)",
    status: "SCHEDULED",
  },
];

export const MOCK_STAFF: AdminStaff[] = [
  {
    id: "st-1",
    role: "ADMIN",
    title: "HR Director & Administrator",
    user: { email: "hr@brutallyhired.com", displayName: "Tanuja HR" },
    createdAt: new Date(Date.now() - 3600000 * 700).toISOString(),
  },
  {
    id: "st-2",
    role: "RECRUITER",
    title: "Senior Tech Talent Partner",
    user: { email: "recruiting@brutallyhired.com", displayName: "Chandra Talent" },
    createdAt: new Date(Date.now() - 3600000 * 500).toISOString(),
  },
  {
    id: "st-3",
    role: "INTERVIEWER",
    title: "Principal Software Architect",
    user: { email: "arun.arch@brutallyhired.com", displayName: "Arun K." },
    createdAt: new Date(Date.now() - 3600000 * 300).toISOString(),
  },
];
